import { useCallback, useEffect, useRef, useState } from "react";
import { ComplaintAPI } from "../../api/complaints";
import { UserAPI } from "../../api/users";

const asNumOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const asArray = (v) => (Array.isArray(v) ? v : []);

const unwrap = (res) => res?.data ?? res;

// tries many keys for total
const pickTotal = (obj) =>
  asNumOrNull(
    obj?.totalUsers ??
      obj?.totalUser ??
      obj?.total ??
      obj?.countTotal ??
      obj?.pagination?.total ??
      obj?.pagination?.totalItems ??
      obj?.meta?.total
  );

export function useAdminDashboardData({ refreshMs = 60000 } = {}) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  const [totals, setTotals] = useState({ totalUsers: null, totalComplaints: null });
  const [userStats, setUserStats] = useState(null);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const inFlightRef = useRef(false);

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setError("");
    silent ? setRefreshing(true) : setInitialLoading(true);

    try {
      const [cResRaw, uResRaw, uStatsResRaw, cStatsResRaw] = await Promise.all([
        ComplaintAPI.getAll({ page: 1, limit: 25, sort: "-createdAt" }),
        UserAPI.getAll({ page: 1, limit: 25, sort: "-createdAt" }),
        UserAPI.getStats(),
        ComplaintAPI.getStats(),
      ]);

      const cRes = unwrap(cResRaw);
      const uRes = unwrap(uResRaw);
      const uStatsRes = unwrap(uStatsResRaw);
      const cStatsRes = unwrap(cStatsResRaw);

      const recentComplaints = asArray(
        cRes?.data?.complaints ?? cRes?.complaints ?? cRes?.data ?? cRes
      );

      const recentUsers = asArray(
        uRes?.data?.users ?? uRes?.users ?? uRes?.data ?? uRes
      );

      // user stats: allow both {stats:{...}} or direct object
      const us = uStatsRes?.stats ?? uStatsRes?.data?.stats ?? uStatsRes?.data ?? uStatsRes ?? {};
      const cs = cStatsRes?.stats ?? cStatsRes?.data?.stats ?? cStatsRes?.data ?? cStatsRes ?? {};

      // IMPORTANT FIX: compute totals with fallback sources
      const totalUsersFromStats = pickTotal(us);
      const totalUsersFromList = pickTotal(uRes) ?? pickTotal(uRes?.data);

      const totalUsers =
        totalUsersFromStats ?? totalUsersFromList ?? asNumOrNull(recentUsers.length);

      const totalComplaints =
        pickTotal(cs) ??
        pickTotal(cRes) ??
        pickTotal(cRes?.data) ??
        asNumOrNull(recentComplaints.length);

      setComplaints(recentComplaints);
      setUsers(recentUsers);

      setUserStats({
        totalUsers,
        activeUsers: asNumOrNull(us.activeUsers ?? us.active),
        admins: asNumOrNull(us.admins ?? us.adminCount),
        staff: asNumOrNull(us.staff ?? us.staffCount),
        users: asNumOrNull(us.users ?? us.userCount),
      });

      setStats({
        openCount: asNumOrNull(cs.openCount) ?? 0,
        pendingCount: asNumOrNull(cs.pendingCount) ?? 0,
        inProgressCount: asNumOrNull(cs.inProgressCount) ?? 0,
        resolvedCount: asNumOrNull(cs.resolvedCount) ?? 0,
        rejectedCount: asNumOrNull(cs.rejectedCount) ?? 0,
        closedCount: asNumOrNull(cs.closedCount) ?? 0,
        resolvedToday: asNumOrNull(cs.resolvedToday) ?? 0,
        completionRate: asNumOrNull(cs.completionRate) ?? 0,
      });

      setTotals({ totalUsers, totalComplaints });
      setLastUpdated(new Date());
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load dashboard data");

      if (!silent) {
        setComplaints([]);
        setUsers([]);
        setTotals({ totalUsers: null, totalComplaints: null });
        setUserStats(null);
        setStats(null);
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAll({ silent: false });
    const id = setInterval(() => fetchAll({ silent: true }), refreshMs);
    return () => clearInterval(id);
  }, [fetchAll, refreshMs]); // proper interval cleanup recommended [web:97]

  return {
    loading: initialLoading,
    refreshing,
    error,
    lastUpdated,
    totals,
    userStats,
    complaints,
    users,
    stats,
    refetch: () => fetchAll({ silent: false }),
    refetchSilent: () => fetchAll({ silent: true }),
  };
}
