import { createContext, useContext, useState, type ReactNode } from "react";

export type ItemDrawerItem =
  | { type: "ticket"; id: string }
  | { type: "activity"; id: string };

interface ItemDrawerState {
  item: ItemDrawerItem | null;
  list: ItemDrawerItem[];
  index: number;
}

interface ItemDrawerContextValue {
  state: ItemDrawerState;
  openTicket: (id: string, list?: ItemDrawerItem[]) => void;
  openActivity: (id: string, list?: ItemDrawerItem[]) => void;
  goNext: () => void;
  goPrev: () => void;
  close: () => void;
}

const ItemDrawerContext = createContext<ItemDrawerContextValue | null>(null);

export function ItemDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ItemDrawerState>({ item: null, list: [], index: -1 });

  const open = (item: ItemDrawerItem, list: ItemDrawerItem[] = []) => {
    const idx = list.findIndex(l => l.type === item.type && l.id === item.id);
    setState({ item, list: list.length > 0 ? list : [item], index: idx >= 0 ? idx : 0 });
  };

  const openTicket = (id: string, list?: ItemDrawerItem[]) => open({ type: "ticket", id }, list);
  const openActivity = (id: string, list?: ItemDrawerItem[]) => open({ type: "activity", id }, list);

  const goNext = () =>
    setState(s => {
      const next = s.index + 1;
      if (next >= s.list.length) return s;
      return { ...s, item: s.list[next], index: next };
    });

  const goPrev = () =>
    setState(s => {
      const prev = s.index - 1;
      if (prev < 0) return s;
      return { ...s, item: s.list[prev], index: prev };
    });

  const close = () => setState({ item: null, list: [], index: -1 });

  return (
    <ItemDrawerContext.Provider value={{ state, openTicket, openActivity, goNext, goPrev, close }}>
      {children}
    </ItemDrawerContext.Provider>
  );
}

export function useItemDrawer() {
  const ctx = useContext(ItemDrawerContext);
  if (!ctx) throw new Error("useItemDrawer must be used inside ItemDrawerProvider");
  return ctx;
}
