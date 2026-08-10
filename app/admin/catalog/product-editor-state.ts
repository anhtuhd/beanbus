export type ProductEditorState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const initialProductEditorState: ProductEditorState = {
  status: 'idle',
  message: '',
};
