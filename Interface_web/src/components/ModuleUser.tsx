import { createContext, useContext } from "react";

/** Solo presentación: las operaciones obtienen el actor de la cookie backend. */
export interface ModuleUser {
  code: string;
  name: string;
  administrator: boolean;
}

export const ModuleUserContext = createContext<ModuleUser | null>(null);

export function useModuleUser(): ModuleUser {
  const user = useContext(ModuleUserContext);
  if (!user) throw new Error("No hay una identidad autenticada en Contabilidad.");
  return user;
}
