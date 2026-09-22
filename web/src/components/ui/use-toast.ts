import * as React from 'react';
import type { ToastActionElement, ToastProps } from './toast';

const LIMITE = 3;
const REMOVER_DEPOIS_MS = 5_000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type State = { toasts: ToasterToast[] };

type Action =
  | { type: 'add'; toast: ToasterToast }
  | { type: 'update'; toast: Partial<ToasterToast> & { id: string } }
  | { type: 'dismiss'; toastId?: string }
  | { type: 'remove'; toastId?: string };

const listeners: Array<(state: State) => void> = [];
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
let memoryState: State = { toasts: [] };
let contador = 0;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return { toasts: [action.toast, ...state.toasts].slice(0, LIMITE) };
    case 'update':
      return {
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case 'dismiss':
      return {
        toasts: state.toasts.map((t) =>
          action.toastId === undefined || t.id === action.toastId ? { ...t, open: false } : t,
        ),
      };
    case 'remove':
      return action.toastId === undefined
        ? { toasts: [] }
        : { toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  for (const listener of listeners) listener(memoryState);
}

function agendarRemocao(toastId: string) {
  if (timeouts.has(toastId)) return;
  timeouts.set(
    toastId,
    setTimeout(() => {
      timeouts.delete(toastId);
      dispatch({ type: 'remove', toastId });
    }, REMOVER_DEPOIS_MS),
  );
}

export function toast({ ...props }: Omit<ToasterToast, 'id'>) {
  const id = String(++contador);

  const dismiss = () => {
    dispatch({ type: 'dismiss', toastId: id });
    agendarRemocao(id);
  };

  dispatch({
    type: 'add',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update: (props: Partial<ToasterToast>) => dispatch({ type: 'update', toast: { ...props, id } }),
  };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'dismiss', toastId }),
  };
}
