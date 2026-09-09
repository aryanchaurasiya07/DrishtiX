export type UserRole = 'ministry' | 'state' | 'district' | 'mp';

export interface UserScope {
  mp_id?: number;
  district?: string;
  state?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  scope: UserScope;
}

export interface WorkListItem {
  id: number;
  mp_id?: number | null;
  category: string;
  mp_name?: string | null;
  agency_name?: string | null;
  district: string;
  state: string;
  risk_band?: 'green' | 'amber' | 'red' | 'insufficient_data' | null;
  risk_score?: number | null;
  top_reason?: string | null;
}

export interface PaginatedWorks {
  items: WorkListItem[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface FlagOut {
  id: number;
  source: string;
  reason_text: string;
}

export interface DuplicatePairOut {
  id: number;
  work_id_a: number;
  work_id_b: number;
  similarity_score: number;
}

export interface RiskScoreOut {
  cost_score?: number | null;
  duplicate_score?: number | null;
  delay_score?: number | null;
  risk_score?: number | null;
  risk_band?: 'green' | 'amber' | 'red' | 'insufficient_data' | null;
}

export interface WorkDetail {
  id: number;
  mp_id?: number | null;
  agency_id?: number | null;
  agency_name?: string | null;
  category: string;
  description?: string | null;
  state: string;
  district: string;
  sanctioned_amt?: number | null;
  released_amt?: number | null;
  expenditure?: number | null;
  sanction_date?: string | null;
  expected_completion?: string | null;
  actual_completion?: string | null;
  status: string;
  risk_scores?: RiskScoreOut | null;
  flags: FlagOut[];
  duplicate_pairs: DuplicatePairOut[];
}

export interface RiskRankedItem {
  id: number;
  category: string;
  district: string;
  state: string;
  risk_score: number;
  risk_band: 'green' | 'amber' | 'red' | 'insufficient_data';
  top_reason?: string | null;
}

export interface CategoryBreakdown {
  category: string;
  flagged_count: number;
  batch_entry_review_count?: number;
}

export interface TrendPoint {
  month: string;
  flagged_count: number;
  batch_entry_review_count?: number;
}

export interface DashboardSummary {
  total_works: number;
  flagged_count: number;
  batch_entry_review_count?: number;
  avg_risk_score: number;
  red_count?: number;
  amber_count?: number;
  green_count?: number;
  insufficient_data_count?: number;
  fund_utilisation_pct?: number | null;
  category_breakdown: CategoryBreakdown[];
  trend: TrendPoint[];
}

export interface DistrictHeatmapItem {
  district: string;
  total_count: number;
  flagged_count: number;
  avg_risk_score: number;
}

