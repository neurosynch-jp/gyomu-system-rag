export const LIMITS = {
  MAX_QUESTION_CHARS: 500,      // 入力の長さ上限（長文でトークンを浪費させない）
  PER_IP_PER_MINUTE: 5,         // 同一IPの1分あたり質問数
  PER_IP_PER_DAY: 50,           // 同一IPの1日あたり質問数
  GLOBAL_PER_DAY: 1000,         // サイト全体の1日あたり質問数（コストの最終防波堤）
};