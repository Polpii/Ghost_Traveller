export interface HandwritingProfile {
  inkColor: string;
  lineAngle: number;
  slant: number;
  wordSpacing: number;
  lineHeightMultiplier: number;
  baselineJitter: number;
  pressure: number;
  scaleX: number;
  scaleY: number;
  guideLineAlpha: number;
}

export interface AnalysisResult {
  ocrText: string;
  language: string;
  confidence?: number;
  replyText: string;
  handwritingProfile: HandwritingProfile;
}

export interface PostcardRenderTheme {
  inkColor?: string;
  paperTone?: string;
  accentColor?: string;
}
