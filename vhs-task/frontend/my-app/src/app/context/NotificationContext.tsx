"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { baseUrl } from "../../page/api/rootApi";
import * as signalR from "@microsoft/signalr";
import { useAppContext } from "./AppProvider";

interface NotificationItem {
  id: string;
  content: string; // Đổi 'message' thành 'content' cho khớp với API
  type: string;
  createdAt: string; // Đổi 'time' thành 'createdAt' cho khớp với API
  isRead: boolean;
  link?: string;
}


const NotificationContext = createContext<any>(null);

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: any) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { user } = useAppContext();

  const markAsRead = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem("accessToken");
      await fetch(`${baseUrl}/api/Notifications/read/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      // Cập nhật state cục bộ để UI thay đổi ngay lập tức
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error("MarkAsRead Error:", err);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem("accessToken");

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/notificationHub`, {
        // Đọc token mới nhất mỗi lần (tự kết nối lại) thay vì token cũ lúc khởi tạo
        accessTokenFactory: () => localStorage.getItem("accessToken") || "" 
      })
      .withAutomaticReconnect()
      .build();

    // Server gửi { id, message, type, time, isRead, link } -> chuẩn hóa về đúng format API (content, createdAt)
    connection.on("ReceiveNotification", (raw: any) => {
      const newNoti: NotificationItem = {
        id: raw.id,
        content: raw.content ?? raw.message ?? "",
        type: raw.type,
        createdAt: raw.createdAt ?? raw.time ?? new Date().toISOString(),
        isRead: !!raw.isRead,
        link: raw.link,
      };
      setNotifications(prev => [newNoti, ...prev]);
    });

    let stopped = false;
    const startConnection = async () => {
      try {
        await connection.start();
        if (!stopped) await connection.invoke("JoinGroup", user.id);
      } catch (err) {
        if (!stopped) console.error("SignalR Connection Error: ", err);
      }
    };

    startConnection();

    fetch(`${baseUrl}/api/Notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => (res.ok ? res.json() : []))
      .then((data: NotificationItem[]) => { if (!stopped) setNotifications(Array.isArray(data) ? data : []); })
      .catch(err => console.error("Fetch Error:", err));

    return () => {
      stopped = true;
      connection.off("ReceiveNotification");
      connection.stop();
    };
  }, [user?.id]);

  const contextValue = useMemo(() => ({ notifications, markAsRead }), [notifications, markAsRead]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};