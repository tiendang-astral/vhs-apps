"use client";
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  company: string;
  deptId: string;
  deptName: string;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

 export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState("task-registration");

  // Load from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setUser({
        id: localStorage.getItem("userId") || "",
        name: localStorage.getItem("fullName") || "User",
        username: localStorage.getItem("username") || "",
        role: (localStorage.getItem("role") || "Staff").toUpperCase(),
        company: (localStorage.getItem("company") || "").toUpperCase(),
        deptId: localStorage.getItem("departmentId") || "",
        deptName: localStorage.getItem("departmentName") || "",
      });
    }
  }, []);

  const value = useMemo(
    () => ({ user, setUser, currentPage, setCurrentPage }),
    [user, currentPage],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};