'use client';

import React from "react"

import { UserRole } from '../utils/workflowUtils';

interface RoleBasedAccessProps {
  requiredRoles: UserRole[];
  currentRole: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanAccess({ requiredRoles, currentRole, children, fallback }: RoleBasedAccessProps) {
  const hasAccess = requiredRoles.includes(currentRole) || currentRole === 'admin';
  return hasAccess ? <>{children}</> : <>{fallback || null}</>;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    staff: 'Nhân viên',
    manager: 'Trưởng phòng',
    director: 'Giám đốc',
    admin: 'Quản trị viên'
  };
  return labels[role];
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    staff: 'bg-blue-100 text-blue-800',
    manager: 'bg-purple-100 text-purple-800',
    director: 'bg-orange-100 text-orange-800',
    admin: 'bg-red-100 text-red-800'
  };
  return colors[role];
}
