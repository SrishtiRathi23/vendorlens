"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { type IsoDate, istDate } from "@/domain/dates";
import type { EventPlan } from "@/domain/schemas";
import { clearStoredPlans, loadActivePlan, saveActivePlan } from "@/lib/local-db/db";

const UNDO_DEPTH = 10;

interface State {
  status: "loading" | "ready";
  plan: EventPlan | null;
  history: EventPlan[];
}

type Action =
  | { type: "loaded"; plan: EventPlan | null }
  | { type: "replace"; plan: EventPlan | null }
  | { type: "update"; change: (plan: EventPlan) => EventPlan; undoable: boolean }
  | { type: "undo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return { status: "ready", plan: action.plan, history: [] };
    case "replace":
      return { ...state, plan: action.plan, history: [] };
    case "update": {
      if (!state.plan) return state;
      const next = action.change(state.plan);
      if (next === state.plan) return state;
      return {
        ...state,
        plan: next,
        history: action.undoable ? [state.plan, ...state.history].slice(0, UNDO_DEPTH) : state.history,
      };
    }
    case "undo": {
      const [previous, ...rest] = state.history;
      return previous ? { ...state, plan: previous, history: rest } : state;
    }
  }
}

interface PlanStore {
  status: State["status"];
  plan: EventPlan | null;
  /** Today's IST date; `null` until the page has mounted, so server and client render the same. */
  today: IsoDate | null;
  canUndo: boolean;
  /** Changes the open plan. Undoable changes can be reverted (up to 10 steps). */
  update: (change: (plan: EventPlan) => EventPlan, options?: { undoable?: boolean }) => void;
  replace: (plan: EventPlan | null) => void;
  undo: () => void;
  clearAll: () => Promise<void>;
}

const PlanContext = createContext<PlanStore | null>(null);

const subscribeToNothing = () => () => undefined;
const clientToday = (): IsoDate => istDate(new Date());
const serverToday = (): IsoDate | null => null;

/** Holds the open plan, persists it to IndexedDB after every change and keeps the undo history. */
export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: "loading", plan: null, history: [] });
  // Today's date is a client-only value: `null` while rendering on the server, the IST date after.
  const today = useSyncExternalStore(subscribeToNothing, clientToday, serverToday);
  const loaded = useRef(false);

  useEffect(() => {
    void loadActivePlan()
      .catch(() => null)
      .then((plan) => {
        loaded.current = true;
        dispatch({ type: "loaded", plan });
      });
  }, []);

  useEffect(() => {
    const plan = state.plan;
    // Saved on every change (an IndexedDB put is cheap), so a reload never loses the last edit.
    if (loaded.current && plan) void saveActivePlan(plan);
  }, [state.plan]);

  const update = useCallback<PlanStore["update"]>((change, options) => {
    dispatch({ type: "update", change, undoable: options?.undoable ?? true });
  }, []);

  const store = useMemo<PlanStore>(
    () => ({
      status: state.status,
      plan: state.plan,
      today,
      canUndo: state.history.length > 0,
      update,
      replace: (plan) => dispatch({ type: "replace", plan }),
      undo: () => dispatch({ type: "undo" }),
      clearAll: async () => {
        await clearStoredPlans();
        dispatch({ type: "replace", plan: null });
      },
    }),
    [state.status, state.plan, state.history.length, today, update],
  );

  return <PlanContext.Provider value={store}>{children}</PlanContext.Provider>;
}

export function usePlanStore(): PlanStore {
  const store = useContext(PlanContext);
  if (!store) throw new Error("usePlanStore must be used inside <PlanProvider>");
  return store;
}
