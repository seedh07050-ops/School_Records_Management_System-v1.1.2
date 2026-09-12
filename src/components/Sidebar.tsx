import React from 'react';
import {
  FileText,
  PlusCircle,
  Archive,
  Clock,
  Layers,
  Tag,
  Trash2,
  FileSpreadsheet,
  Building2,
  BookOpen,
  AlertTriangle,
  SendHorizontal,
} from 'lucide-react';
import { MenuKey, RecordItem, RetentionPeriod } from '../types';
import { calculateExpiryYear } from '../utils/recordUtils';

interface SidebarProps {
  currentMenu: MenuKey;
  onSelectMenu: (menu: MenuKey) => void;
  records: RecordItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentMenu, onSelectMenu, records }) => {
  // 활성 기록물 계산 (완료 상태 & 미폐기 & 미이관)
  const activeRecords = records.filter((r) => r.is_completed && !r.is_disposed && !r.is_transferred);
  const pendingInputCount = records.filter((r) => !r.is_completed && !r.is_disposed && !r.is_transferred).length;
  const disposedCount = records.filter((r) => r.is_disposed).length;
  const transferredCount = records.filter((r) => r.is_transferred && !r.is_disposed).length;

  const currentYear = new Date().getFullYear();
  const disposalTargetCount = records.filter((r) => {
    if (!r.is_completed || r.is_disposed || r.is_transferred || r.is_disposal_deferred) return false;
    if (!['10년', '5년', '3년', '1년'].includes(r.retention_period)) return false;
    const exp = parseInt(calculateExpiryYear(r.end_year, r.retention_period), 10);
    return !isNaN(exp) && exp <= currentYear;
  }).length;

  const countByPeriod = (period: RetentionPeriod): number => {
    return activeRecords.filter((r) => r.retention_period === period).length;
  };

  const navSections = [
    {
      title: '총괄 대장 및 등록',
      items: [
        {
          key: 'cover' as MenuKey,
          label: '표지 및 현황',
          icon: Building2,
          badge: `${activeRecords.length}건`,
          badgeColor: 'bg-blue-600 text-white',
        },
        {
          key: 'input' as MenuKey,
          label: '입력 (신규/일괄)',
          icon: PlusCircle,
          badge: pendingInputCount > 0 ? `작성중 ${pendingInputCount}` : undefined,
          badgeColor: 'bg-amber-500 text-white',
        },
      ],
    },
    {
      title: '보존기간별 기록물',
      items: [
        {
          key: 'retention_permanent' as MenuKey,
          label: '영구',
          icon: Archive,
          badge: countByPeriod('영구'),
          badgeColor: 'bg-red-100 text-red-700',
        },
        {
          key: 'retention_semi_permanent' as MenuKey,
          label: '준영구',
          icon: Archive,
          badge: countByPeriod('준영구'),
          badgeColor: 'bg-orange-100 text-orange-700',
        },
        {
          key: 'retention_30' as MenuKey,
          label: '30년',
          icon: Clock,
          badge: countByPeriod('30년'),
          badgeColor: 'bg-amber-100 text-amber-800',
        },
        {
          key: 'retention_10' as MenuKey,
          label: '10년',
          icon: Clock,
          badge: countByPeriod('10년'),
          badgeColor: 'bg-emerald-100 text-emerald-800',
        },
        {
          key: 'retention_5' as MenuKey,
          label: '5년',
          icon: Clock,
          badge: countByPeriod('5년'),
          badgeColor: 'bg-sky-100 text-sky-800',
        },
        {
          key: 'retention_3' as MenuKey,
          label: '3년',
          icon: Clock,
          badge: countByPeriod('3년'),
          badgeColor: 'bg-indigo-100 text-indigo-800',
        },
        {
          key: 'retention_1' as MenuKey,
          label: '1년',
          icon: Clock,
          badge: countByPeriod('1년'),
          badgeColor: 'bg-slate-200 text-slate-700',
        },
      ],
    },
    {
      title: '업무 기준 및 라벨',
      items: [
        {
          key: 'task_cards' as MenuKey,
          label: '과제카드',
          icon: BookOpen,
        },
        {
          key: 'labels' as MenuKey,
          label: '라벨출력',
          icon: Tag,
        },
        {
          key: 'disposal_target' as MenuKey,
          label: '폐기대상',
          icon: AlertTriangle,
          badge: disposalTargetCount > 0 ? `${disposalTargetCount}건` : undefined,
          badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
        },
        {
          key: 'disposal' as MenuKey,
          label: '폐기확정목록',
          icon: Trash2,
          badge: disposedCount > 0 ? `${disposedCount}건` : undefined,
          badgeColor: 'bg-rose-100 text-rose-800',
        },
        {
          key: 'transfer' as MenuKey,
          label: '이관목록',
          icon: SendHorizontal,
          badge: transferredCount > 0 ? `${transferredCount}건` : undefined,
          badgeColor: 'bg-blue-100 text-blue-800 font-bold',
        },
        {
          key: 'forms' as MenuKey,
          label: '업무서식',
          icon: FileText,
          badge: '5종',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold',
        },
        {
          key: 'excel_export' as MenuKey,
          label: 'Excel 내보내기',
          icon: FileSpreadsheet,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 min-h-screen border-r border-slate-800 shadow-xl select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
              학교 기록물 관리
            </h1>
            <p className="text-xs text-slate-400 font-medium">기록물관리 시스템</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5 text-sm">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = currentMenu === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  id={`nav-btn-${item.key}`}
                  onClick={() => onSelectMenu(item.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-xs transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1">
          <span>보유 기록물</span>
          <span className="font-bold text-blue-400">{activeRecords.length} 권/철</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          단일 원본(Source of Truth) 구조로 화면 간 실시간 자동 동기화
        </p>
      </div>
    </aside>
  );
};
