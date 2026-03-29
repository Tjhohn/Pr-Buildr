export interface DraftState {
  generated: { title: string; body: string } | null;
  current: { title: string; body: string };
  base: string;
  head: string;
  isEdited: boolean;
  isStale: boolean;
}
