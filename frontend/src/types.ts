export interface Smell {
  type: 'nested_conditionals' | 'large_function' | 'cognitive_complexity';
  msg: string;
}

export interface SmellReport {
  id: string;
  function_name: string;
  start_line: number;
  end_line: number;
  smells: Smell[];
  smells_json?: Smell[];        // API returns smells_json; we normalise in hooks
  nesting_depth: number;
  length: number;
  cognitive_complexity: number;
}

export interface RefactorRun {
  id: string;
  repo_id: string | null;
  repo?: string;
  filepath: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  smells: SmellReport[];
  attempts: number;
  pr_url: string | null;
  pr_merged: boolean;
  dry_run: boolean;
  branch: string | null;
  started_at: string;
  completed_at: string | null;
  diff: string | null;
  test_output: string | null;
  duration_sec?: number | null;
}

export interface FunctionHistoryPoint {
  date: string;
  cognitive: number;
  run_id: string;
  status: string;
}

export interface FunctionHistory {
  function_name: string;
  history: FunctionHistoryPoint[];
}

export interface Metrics {
  total_runs: number;
  issues_found: number;
  fixes_passed: number;
  fixes_failed: number;
  prs_generated: number;
  avg_attempts: number;
  success_rate: number;
  avg_time_sec: number;
  weekly_trend: { day: string; fixed: number; found: number }[];
  smell_breakdown: { type: string; count: number }[];
}

export interface Repo {
  id: string;
  name: string;
  github_owner: string;
  full_name: string;
  status: 'active' | 'idle' | 'paused';
  last_run_at: string | null;
  total_fixes: number;
  total_runs: number;
  created_at: string;
}

export interface AgentSettings {
  id: string;
  max_attempts: number;
  max_cognitive: number;
  max_nesting: number;
  max_length: number;
  github_enabled: boolean;
  github_owner: string | null;
  github_repo: string | null;
  model_name: string;
  use_docker: boolean;
  docker_image: string;
  branch_prefix: string;
  allowlist_dirs: string[];
  blacklist_dirs: string[];
  updated_at: string;
}

export interface GhostUser {
  id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export type Theme = 'dark' | 'light';

export interface HeatmapFunction {
  name: string;
  cognitive: number;
  nesting: number;
  length: number;
  fixed: boolean;
}

export interface HeatmapFile {
  path: string;
  functions: HeatmapFunction[];
}
