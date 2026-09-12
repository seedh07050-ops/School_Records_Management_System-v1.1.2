import React, { useState, useMemo } from 'react';
import { TaskCard, RetentionPeriod, RETENTION_PERIODS } from '../types';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Info,
  Check,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface TaskCardsViewProps {
  taskCards: TaskCard[];
  onAddTaskCard: (card: TaskCard) => void;
  onUpdateTaskCard: (card: TaskCard) => void;
  onDeleteTaskCard: (id: string) => void;
}

export const TaskCardsView: React.FC<TaskCardsViewProps> = ({
  taskCards,
  onAddTaskCard,
  onUpdateTaskCard,
  onDeleteTaskCard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<TaskCard | null>(null);

  // 폼 입력 상태
  const [formName, setFormName] = useState('');
  const [formPeriod, setFormPeriod] = useState<RetentionPeriod>('5년');
  const [formDescription, setFormDescription] = useState('');

  // 삭제 확인 모달 상태
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    card: TaskCard | null;
  }>({
    isOpen: false,
    card: null,
  });

  const filteredCards = useMemo(() => {
    return taskCards.filter((card) => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = card.name.toLowerCase().includes(query);
        const matchDesc = (card.description || '').toLowerCase().includes(query);
        if (!matchName && !matchDesc) return false;
      }
      if (filterPeriod !== 'all' && card.period !== filterPeriod) {
        return false;
      }
      return true;
    });
  }, [taskCards, searchTerm, filterPeriod]);

  const handleOpenAddModal = () => {
    setEditingCard(null);
    setFormName('');
    setFormPeriod('5년');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (card: TaskCard) => {
    setEditingCard(card);
    setFormName(card.name);
    setFormPeriod(card.period);
    setFormDescription(card.description || '');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('과제카드명을 입력해주세요.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (editingCard) {
      // 수정
      onUpdateTaskCard({
        ...editingCard,
        name: formName.trim(),
        period: formPeriod,
        description: formDescription.trim(),
        updated_at: today,
      });
    } else {
      // 신규 등록
      const newCard: TaskCard = {
        id: `card-${Date.now()}`,
        name: formName.trim(),
        period: formPeriod,
        description: formDescription.trim(),
        created_at: today,
        updated_at: today,
      };
      onAddTaskCard(newCard);
    }

    setIsModalOpen(false);
  };

  const handleDeleteCard = (card: TaskCard) => {
    setDeleteConfirmModal({
      isOpen: true,
      card,
    });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              학교 행정 과제카드 및 표준 보존기간 관리
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              총 {taskCards.length}개 카드
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            학교 기록관리 기준표 상의 과제카드 목록입니다. 신규 기록물 등록 시 AI가 본 과제카드를 참조하여 보존기간을 추천합니다.
          </p>
        </div>

        <button
          id="btn-add-task-card"
          onClick={handleOpenAddModal}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          신규 과제카드 등록
        </button>
      </div>

      {/* Critical Principle Warning Callout (Principle 11) */}
      <div className="bg-amber-50/90 border-2 border-amber-300 rounded-lg p-4 text-amber-900 shadow-2xs space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          [필독] 과제카드 수정 시 기존 확정 기록물 보존 원칙 (소급 적용 불가)
        </div>
        <p className="text-xs text-amber-800 leading-relaxed pl-6">
          과제카드의 표준 보존기간을 수정하거나 과제카드를 삭제하더라도, <strong>이미 입력완료되어 대장에 등록된 기존 기록물의 보존기간은 자동으로 바뀌지 않고 안전하게 유지됩니다.</strong> 과제카드 변경사항은 앞으로 새롭게 입력될 기록물의 AI 추천에만 반영됩니다.
        </p>
      </div>

      {/* Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="과제카드명 또는 업무 설명 검색..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-blue-600 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-slate-500 font-medium">보존기간 필터:</span>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
          >
            <option value="all">전체 보존기간</option>
            {RETENTION_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Cards Grid Table */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 divide-x divide-slate-300">
                <th className="p-2.5 w-12 text-center">순번</th>
                <th className="p-2.5 min-w-[200px]">과제카드명</th>
                <th className="p-2.5 w-24 text-center">표준 보존기간</th>
                <th className="p-2.5 min-w-[320px]">업무 설명 및 세부 내용</th>
                <th className="p-2.5 w-24 text-center">수정일</th>
                <th className="p-2.5 w-20 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-sm">
                    일치하는 과제카드가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredCards.map((card, idx) => (
                  <tr
                    key={card.id}
                    className={`divide-x divide-slate-200 hover:bg-blue-50/30 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="p-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        {card.name}
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                          card.period === '영구'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : card.period === '준영구'
                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                            : card.period === '10년'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : card.period === '5년'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {card.period}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600 leading-relaxed">
                      {card.description || '-'}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">
                      {card.updated_at || card.created_at || '-'}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(card)}
                          className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                          title="수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card)}
                          className="p-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit TaskCard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCard ? '과제카드 수정' : '신규 과제카드 등록'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  과제카드명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="예: 학교회계 예·결산서"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  표준 보존기간 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value as RetentionPeriod)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-bold text-blue-900 focus:outline-blue-600 bg-white"
                >
                  {RETENTION_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  업무 설명 및 세부 내용 (AI 유사도 판별 시 참조)
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="예: 본예산, 추경예산, 결산서, 성립전예산 편성 및 관련 회계 증빙서류 일체"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-blue-600 leading-relaxed"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-[11px] text-slate-500 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <span>
                  과제카드가 등록되면 신규 기록물 입력 시 AI 추천 알고리즘이 해당 업무 설명을 분석하여 보존기간을 추천합니다.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 border border-slate-300 rounded hover:bg-slate-50 font-medium cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title="과제카드 삭제 확인"
        message={`과제카드 "${deleteConfirmModal.card?.name}"을(를) 삭제하시겠습니까?`}
        detail="* 이미 등록된 기존 기록물의 보존기간에는 전혀 영향을 주지 않으며 소급 변경되지 않습니다. 향후 신규 입력 시 AI 추천 목록에서만 제외됩니다."
        confirmText="과제카드 삭제"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmModal.card) {
            onDeleteTaskCard(deleteConfirmModal.card.id);
          }
          setDeleteConfirmModal({ isOpen: false, card: null });
        }}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, card: null })}
      />
    </div>
  );
};
