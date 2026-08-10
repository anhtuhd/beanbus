export type ContentEditorState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const initialContentEditorState: ContentEditorState = { status: 'idle', message: '' };
