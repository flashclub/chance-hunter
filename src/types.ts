export interface LanguageOption {
  code: string;
  name: string;
}

// Grounding chunk structure for Google Search results
export interface GroundingChunkWeb {
  uri?: string; // Made optional to match @google/genai type
  title?: string; // Made optional to match @google/genai type
}
export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // Other types of chunks can be added if needed
}

// Web Components 类型声明
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "img-comparison-slider": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          value?: string;
          hover?: string;
          keyboard?: string;
          direction?: "horizontal" | "vertical";
          handle?: string;
        },
        HTMLElement
      >;
    }
  }
}

// 确保这个文件被视为模块
export {};
