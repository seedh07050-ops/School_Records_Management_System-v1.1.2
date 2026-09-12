export type RecordType = '일반' | '시청각';

export type RetentionPeriod = '준영구' | '영구' | '30년' | '10년' | '5년' | '3년' | '1년';

export const RETENTION_PERIODS: RetentionPeriod[] = [
  '준영구',
  '영구',
  '30년',
  '10년',
  '5년',
  '3년',
  '1년',
];

export interface RecordItem {
  record_id: string; // 내부 고유 불변 식별자 (Source of Truth, 예: REC-2024-0001)
  record_no: string; // 화면 표시용 기록물 고유번호 (형식: [보존기간]-[6자리 숫자], 예: 5년-000064)
  record_type: RecordType; // 기록물 유형 ('일반' | '시청각')
  start_year: number; // 생산년도
  end_year: number; // 종료년도
  retention_period: RetentionPeriod; // 보존기간
  title: string; // 기록물철제목
  box_no: string; // 상자번호
  shelf_no: string; // 서가번호
  is_completed: boolean; // 입력완료 여부 (false: 임시 입력, true: 정식 관리)
  is_disposed: boolean; // 폐기 여부
  disposal_date: string | null; // 폐기일자 (YYYY-MM-DD)
  is_disposal_deferred?: boolean; // 폐기대상 목록에서 보류 처리 여부 (보류 시 폐기대상에서 숨김, 보존기간 대장은 유지)
  is_transferred?: boolean; // 기록관 이관 여부
  transfer_date?: string | null; // 이관일자 (YYYY-MM-DD)
  transfer_destination?: string | null; // 이관처 (예: 전북특별자치도교육청 기록관)
  production_school?: string; // 생산학교명 (문서고보존기록대장 서식)
  management_school?: string; // 관리학교명 (문서고보존기록대장 서식)
  internal_transfer_date?: string; // 기관(학교)내 이관일자
  transfer_action?: string; // 기록관 처리내용
  created_at: string;
  updated_at: string;
}

export interface TaskCard {
  id: string;
  name: string; // 과제카드명
  period: RetentionPeriod; // 보존기간
  description: string; // 설명 또는 업무내용
  created_at: string;
  updated_at: string;
}

export interface DepartmentMeta {
  department: string; // 처리과/부서명 (기본값: 전북초등학교)
  base_date: string; // 기준일자 (YYYY-MM-DD)
  school_name: string; // 학교명/기관명 (기본값: 전북특별자치도교육청)
  institution?: string; // 기관명 (기본값: 전북특별자치도교육청)
  manager_name?: string; // 담당자명
}

export interface SimilarTaskCardResult {
  rank?: number;
  id?: string;
  name: string;
  period: RetentionPeriod;
  similarity: number;
  matchedKeywords?: string[];
  reason: string;
}

export interface RecommendationResult {
  recommended_period: RetentionPeriod;
  similar_task_cards: SimilarTaskCardResult[];
  overall_reason?: string;
  is_none?: boolean;
  matched_card_name?: string;
}

export type AIRecommendationResult = RecommendationResult;

export interface BoxGroup {
  box_no: string;
  shelf_no: string;
  records: RecordItem[];
  record_count: number;
  retention_periods: RetentionPeriod[];
  year_range: string;
}

export type MenuKey =
  | 'cover'
  | 'input'
  | 'retention_permanent'
  | 'retention_semi_permanent'
  | 'retention_30'
  | 'retention_10'
  | 'retention_5'
  | 'retention_3'
  | 'retention_1'
  | 'task_cards'
  | 'labels'
  | 'disposal_target'
  | 'disposal'
  | 'transfer'
  | 'forms'
  | 'excel_export';

export interface SaveFileResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface SaveAllFormsResult {
  success: boolean;
  folderPath?: string;
  savedCount?: number;
  savedFiles?: string[];
  canceled?: boolean;
  errors?: string[];
}

export interface FullExcelImportResult {
  records: RecordItem[];
  meta?: Partial<DepartmentMeta>;
  taskCards?: TaskCard[];
  stats: {
    totalRecords: number;
    activeRecords: number;
    pendingRecords: number;
    disposedRecords: number;
    transferredRecords: number;
    taskCardsCount: number;
  };
  sourceFileName: string;
}

export interface DesktopAPI {
  isDesktop: boolean;
  isTauri: boolean;
  isElectron: boolean;
  platform: string;
  getVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
  showItemInFolder: (fullPath: string) => Promise<void>;
  showSaveDialog?: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
  saveFormFile: (fileName: string) => Promise<SaveFileResult>;
  saveAllForms: (fileNames: string[]) => Promise<SaveAllFormsResult>;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  getVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
  showItemInFolder: (fullPath: string) => Promise<void>;
  showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
  saveFormFile: (fileName: string) => Promise<SaveFileResult>;
  saveAllForms: (fileNames: string[]) => Promise<SaveAllFormsResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    desktopAPI?: DesktopAPI;
    __TAURI_INTERNALS__?: any;
    __TAURI__?: any;
  }
}
