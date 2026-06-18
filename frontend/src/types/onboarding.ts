export type Screen = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ClassifyResult {
  business_type: string;
  display_name: string;
  theme_color: string;
  suggested_questions: string[];
}

export interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
}

export interface OnboardingState {
  screen: Screen;
  businessDescription: string;
  classifyResult: ClassifyResult | null;
  ownerName: string;
  phone: string;
  botId: string | null;
  botSlug: string | null;
  uploadType: 'url' | 'pdf';
  urlInput: string;
  fileInput: File | null;
  waConnected: boolean;
  testMessages: ChatMessage[];
  hasTestedBot: boolean;
  playgroundUrl: string;
  embedCode: string;
}
