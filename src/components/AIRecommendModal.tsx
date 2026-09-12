import React, { useState } from 'react';
import {
  FileSearch,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  HelpCircle,
  X,
  Layers,
  Tag,
} from 'lucide-react';
import { RecommendationResult, RetentionPeriod, RETENTION_PERIODS } from '../types';

interface AIRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordTitle: string;
  recommendation: RecommendationResult | null;
  isLoading?: boolean;
  onApplyPeriod: (period: RetentionPeriod) => void;
}

export const AIRecommendModal: React.FC<AIRecommendModalProps> = ({
  isOpen,
  onClose,
  recordTitle,
  recommendation,
  isLoading = false,
  onApplyPeriod,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<RetentionPeriod | null>(null);

  if (!isOpen) return null;

  const topCard = recommendation?.similar_task_cards?.[0];
  const isNoMatch =
    recommendation?.is_none ||
    !topCard ||
    topCard.similarity <= 15 ||
    topCard.name === '해당없음';

  const finalRecommendedPeriod = isNoMatch
    ? '5년'
    : recommendation?.recommended_period || '5년';

  const currentSelection = selectedPeriod || finalRecommendedPeriod;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
              <FileSearch className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white">
                유사 과제카드 추천
              </h3>
              <p className="text-xs text-blue-200">
                기록물철제목과 과제카드명을 비교하여 유사도가 높은 순으로 추천합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Target Record Title */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              비교 대상 기록물철제목
            </span>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
              "{recordTitle}"
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-slate-700">
                과제카드 데이터베이스와 제목 유사도를 계산하는 중입니다...
              </p>
            </div>
          ) : recommendation ? (
            <div className="space-y-5">
              {/* Recommendation Highlight Box */}
              <div
                className={`border-2 rounded-xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isNoMatch
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-blue-50/70 border-blue-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {isNoMatch ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 border border-amber-300">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        유사 과제카드 없음 (해당없음)
                      </span>
                    ) : (
                      <span className="text-blue-700 inline-flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        추천 보존기간
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-black tracking-tight ${
                        isNoMatch ? 'text-amber-950' : 'text-blue-900'
                      }`}
                    >
                      {finalRecommendedPeriod}
                    </span>
                    {!isNoMatch && topCard && (
                      <span className="text-xs font-semibold text-slate-600">
                        (최상위 유사 과제카드: <strong>{topCard.name}</strong>)
                      </span>
                    )}
                  </div>

                  {/* Mandated Disclaimer Notice */}
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                    ※ 과제카드명과의 유사도를 기준으로 산출한 참고용 추천 결과입니다. 실제 보존기간 결정 시 해당 과제카드 및 관련 기준을 확인하시기 바랍니다.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                  <button
                    id="btn-apply-recommended-period"
                    onClick={() => {
                      onApplyPeriod(finalRecommendedPeriod);
                      onClose();
                    }}
                    className={`w-full sm:w-auto px-4 py-2.5 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isNoMatch
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isNoMatch ? '기본기간(5년) 적용' : `추천기간(${finalRecommendedPeriod}) 적용`}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Similar Task Cards Top 3 Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    유사 과제카드 상위 3개 비교 결과
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    로컬 문자열 및 핵심어 알고리즘 계산
                  </span>
                </div>

                {isNoMatch ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center space-y-1.5">
                    <span className="inline-block px-3 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-full">
                      해당없음
                    </span>
                    <p className="text-xs text-slate-700 font-medium">
                      등록된 과제카드 목록 중 부합하거나 유사한 업무 과제카드가 없습니다.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      기본 권장 보존기간인 <strong>5년</strong>이 적용 추천되었습니다.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12">순위</th>
                          <th className="py-2.5 px-3">과제카드명</th>
                          <th className="py-2.5 px-3 text-center w-20">보존기간</th>
                          <th className="py-2.5 px-3 text-center w-20">유사도</th>
                          <th className="py-2.5 px-3">일치 핵심어</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recommendation.similar_task_cards.map((card, idx) => {
                          const matchedText =
                            card.matchedKeywords && card.matchedKeywords.length > 0
                              ? card.matchedKeywords.join(', ')
                              : card.reason || '-';

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                idx === 0 ? 'bg-blue-50/30 font-semibold' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                                    idx === 0
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {card.rank || idx + 1}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-900">
                                  {card.name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                                  {card.period}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                    card.similarity >= 85
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : card.similarity >= 60
                                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {card.similarity}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                <span className="inline-flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                  <Tag className="w-3 h-3 text-slate-400" />
                                  {matchedText}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* User Overriding Freedom Notice */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  사용자 직접 선택 및 최종 결정
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  추천 결과와 무관하게 담당자가 원하는 보존기간을 직접 선택하여 적용할 수 있습니다.
                </p>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="font-semibold text-slate-700">보존기간 직접 선택:</span>
                  <select
                    id="select-custom-retention-period"
                    value={currentSelection}
                    onChange={(e) => setSelectedPeriod(e.target.value as RetentionPeriod)}
                    className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold bg-white focus:outline-blue-500"
                  >
                    {RETENTION_PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))}
                  </select>
                  <button
                    id="btn-apply-custom-period"
                    onClick={() => {
                      onApplyPeriod(currentSelection);
                      onClose();
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    선택한 보존기간({currentSelection})으로 확정
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm">
              분석 결과가 없습니다.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            인터넷 연결이나 외부 API 없이 로컬 알고리즘으로 즉시 계산됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
