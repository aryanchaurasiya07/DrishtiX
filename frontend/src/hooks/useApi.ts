import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import {
  PaginatedWorks,
  WorkDetail,
  RiskRankedItem,
  DashboardSummary,
  DistrictHeatmapItem,
} from '../api/types';

export interface WorksFilterParams {
  mp_id?: number;
  state?: string;
  district?: string;
  category?: string;
  risk_band?: string;
  page?: number;
  page_size?: number;
}

export const useWorks = (params: WorksFilterParams = {}) => {
  const [data, setData] = useState<PaginatedWorks | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<PaginatedWorks>('/works', { params });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch works');
    } finally {
      setLoading(false);
    }
  }, [params.mp_id, params.state, params.district, params.category, params.risk_band, params.page, params.page_size]);

  useEffect(() => {
    fetchWorks();
  }, [fetchWorks]);

  return { data, loading, error, refetch: fetchWorks };
};

export const useWorkDetail = (workId: number | null) => {
  const [data, setData] = useState<WorkDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!workId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<WorkDetail>(`/works/${workId}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch work detail');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
};

export const useRiskRanked = (limit: number = 20, mpId?: number) => {
  const [data, setData] = useState<RiskRankedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRanked = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<RiskRankedItem[]>('/risk-ranked', {
        params: { limit, ...(mpId ? { mp_id: mpId } : {}) },
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch risk-ranked works');
    } finally {
      setLoading(false);
    }
  }, [limit, mpId]);

  useEffect(() => {
    fetchRanked();
  }, [fetchRanked]);

  return { data, loading, error, refetch: fetchRanked };
};

export const useDashboardSummary = (params?: { mp_id?: number }) => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<DashboardSummary>('/dashboard/summary', { params });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch dashboard summary');
    } finally {
      setLoading(false);
    }
  }, [params?.mp_id]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, refetch: fetchSummary };
};

export const useDistrictHeatmap = () => {
  const [data, setData] = useState<DistrictHeatmapItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<DistrictHeatmapItem[]>('/dashboard/heatmap');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch heatmap data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  return { data, loading, error, refetch: fetchHeatmap };
};

