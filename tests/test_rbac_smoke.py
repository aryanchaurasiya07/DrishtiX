"""
RBAC Smoke Test Script

Tests:
1. Login as mp_user (mp_id = 1)
   - GET /works/1 (in-scope) -> 200 OK
   - GET /works/8 (out-of-scope, belongs to MP 2) -> 403 Forbidden
2. Login as district_user (district = 'Bhopal')
   - GET /risk-ranked -> all returned items must have district == 'Bhopal'
   - GET /works -> all returned items must have district == 'Bhopal'
3. Login as ministry_user
   - GET /works -> sees works across all states and districts
"""

import sys
from pathlib import Path

# Ensure repo root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_rbac():
    print("=" * 60)
    print("RUNNING RBAC SMOKE TEST")
    print("=" * 60)

    # ─────────────────────────────────────────────────────────────
    # TEST 1: MP User (mp_id = 1)
    # ─────────────────────────────────────────────────────────────
    print("\n[1] Logging in as mp_user ...")
    resp = client.post("/auth/login", json={"username": "mp_user", "password": "mp123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    mp_data = resp.json()
    mp_token = mp_data["access_token"]
    print(f"    Role: {mp_data['role']}, Scope: {mp_data['scope']}")
    assert mp_data["role"] == "mp"
    assert mp_data["scope"].get("mp_id") == 1

    headers_mp = {"Authorization": f"Bearer {mp_token}"}

    print("\n[2] Fetching in-scope work (Work #1, mp_id=1) as mp_user ...")
    resp = client.get("/works/1", headers=headers_mp)
    print(f"    Status: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    work_1 = resp.json()
    print(f"    Work ID: {work_1['id']}, Category: {work_1['category']}, MP ID: {work_1['mp_id']}")
    assert work_1["mp_id"] == 1

    print("\n[3] Attempting to fetch out-of-scope work (Work #226, mp_id=2) as mp_user ...")
    resp = client.get("/works/226", headers=headers_mp)
    print(f"    Status: {resp.status_code} ({resp.json()})")
    assert resp.status_code == 403, f"Expected 403 Forbidden, got {resp.status_code}: {resp.text}"
    print("    [PASS] 403 Forbidden correctly returned for out-of-scope work!")

    # ─────────────────────────────────────────────────────────────
    # TEST 2: District User (district = 'Bhopal')
    # ─────────────────────────────────────────────────────────────
    print("\n[4] Logging in as district_user ...")
    resp = client.post("/auth/login", json={"username": "district_user", "password": "district123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    dist_data = resp.json()
    dist_token = dist_data["access_token"]
    print(f"    Role: {dist_data['role']}, Scope: {dist_data['scope']}")
    assert dist_data["role"] == "district"
    assert dist_data["scope"].get("district") == "Bhopal"

    headers_dist = {"Authorization": f"Bearer {dist_token}"}

    print("\n[5] Fetching GET /risk-ranked as district_user ...")
    resp = client.get("/risk-ranked?limit=20", headers=headers_dist)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    ranked_items = resp.json()
    print(f"    Returned {len(ranked_items)} risk-ranked items.")
    for item in ranked_items:
        assert item["district"] == "Bhopal", f"Leaked work from another district: {item}"
    print(f"    [PASS] All {len(ranked_items)} items belong exclusively to district 'Bhopal'!")

    print("\n[6] Fetching GET /works as district_user ...")
    resp = client.get("/works?page=1&page_size=50", headers=headers_dist)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    works_page = resp.json()
    print(f"    Total in-scope works for Bhopal: {works_page['total_count']}")
    for item in works_page["items"]:
        assert item["district"] == "Bhopal", f"Leaked work from another district: {item}"
    print(f"    [PASS] All {len(works_page['items'])} listed works belong exclusively to 'Bhopal'!")

    # ─────────────────────────────────────────────────────────────
    # TEST 3: State User (state = 'Madhya Pradesh')
    # ─────────────────────────────────────────────────────────────
    print("\n[7] Logging in as state_user ...")
    resp = client.post("/auth/login", json={"username": "state_user", "password": "state123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    state_data = resp.json()
    state_token = state_data["access_token"]
    print(f"    Role: {state_data['role']}, Scope: {state_data['scope']}")
    assert state_data["role"] == "state"
    assert state_data["scope"].get("state") == "Madhya Pradesh"

    headers_state = {"Authorization": f"Bearer {state_token}"}

    print("\n[8] Fetching GET /works as state_user ...")
    resp = client.get("/works?page=1&page_size=50", headers=headers_state)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    state_works_page = resp.json()
    print(f"    Total in-scope works for Madhya Pradesh: {state_works_page['total_count']}")
    for item in state_works_page["items"]:
        assert item["state"] == "Madhya Pradesh", f"Leaked work from another state: {item}"
    print(f"    [PASS] All {len(state_works_page['items'])} listed works belong exclusively to 'Madhya Pradesh'!")

    # ─────────────────────────────────────────────────────────────
    # TEST 4: Ministry User (sees all)
    # ─────────────────────────────────────────────────────────────
    print("\n[9] Logging in as ministry_user ...")
    resp = client.post("/auth/login", json={"username": "ministry_user", "password": "ministry123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    min_token = resp.json()["access_token"]
    headers_min = {"Authorization": f"Bearer {min_token}"}

    print("\n[10] Fetching GET /dashboard/summary as ministry_user ...")
    resp = client.get("/dashboard/summary", headers=headers_min)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    summary = resp.json()
    print(f"    Total works in system: {summary['total_works']}")
    print(f"    Total flagged works: {summary['flagged_count']}")
    print(f"    Avg risk score: {summary['avg_risk_score']}")
    print(f"    Fund utilisation: {summary['fund_utilisation_pct']}%")
    assert summary["total_works"] == 214194
    print("    [PASS] Ministry user sees all 214,194 works system-wide!")

    print("\n" + "=" * 60)
    print("ALL RBAC SMOKE TESTS PASSED [OK]")
    print("=" * 60)


if __name__ == "__main__":
    test_rbac()
