import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AnalysisResult } from '../types/analysis';

interface AnalysisStoreValue {
  localAnalyses: AnalysisResult[];
  getLocalAnalysis: (publicId: string) => AnalysisResult | undefined;
  saveLocalAnalysis: (analysis: AnalysisResult) => void;
  forgetLocalAnalysis: (publicId: string) => void;
}

const AnalysisStore = createContext<AnalysisStoreValue | undefined>(undefined);

export function AnalysisStoreProvider({ children }: { children: ReactNode }) {
  const [localAnalyses, setLocalAnalyses] = useState<AnalysisResult[]>([]);

  const value = useMemo<AnalysisStoreValue>(() => ({
    localAnalyses,
    getLocalAnalysis: (publicId) => localAnalyses.find((analysis) => analysis.publicId === publicId),
    saveLocalAnalysis: (analysis) => {
      setLocalAnalyses((previous) => [analysis, ...previous.filter((item) => item.publicId !== analysis.publicId)]);
    },
    forgetLocalAnalysis: (publicId) => {
      setLocalAnalyses((previous) => previous.filter((item) => item.publicId !== publicId));
    },
  }), [localAnalyses]);

  return <AnalysisStore.Provider value={value}>{children}</AnalysisStore.Provider>;
}

export function useAnalysisStore(): AnalysisStoreValue {
  const value = useContext(AnalysisStore);
  if (!value) throw new Error('useAnalysisStore must be used inside AnalysisStoreProvider');
  return value;
}
