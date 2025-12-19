import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/apiClient";
import { toast } from "react-toastify";
import {
  FiUsers,
  FiUserCheck,
  FiUserX,
  FiShield,
  FiEdit3,
  FiTrash2,
  FiSearch,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiMail,
  FiBriefcase,
  FiFilter,
} from "react-icons/fi";

/** ====================== Utilities ====================== */
const getRoleBadgeStyle = (role) => {
  const styles = {
    admin: "bg-purple-100 text-purple-700 border-purple-300",
    staff: "bg-indigo-100 text-indigo-700 border-indigo-300",
    user: "bg-blue-100 text-blue-700 border-blue-300",
  };
  return styles[(role || "user").toLowerCase()] || styles.user;
};

const getAvatarColor = (name) => {
  const colors = [
    "bg-gradient-to-br from-red-400 to-red-600",
    "bg-gradient-to-br from-yellow-400 to-yellow-600",
    "bg-gradient-to-br from-green-400 to-green-600",
    "bg-gradient-to-br from-blue-400 to-blue-600",
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

const normalizeImageUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const apiBaseUrl =
    import.meta.env.VITE_API_URL || "https://backend-h5g5.onrender.com";

  const cleanUrl = url.startsWith("/api/") ? url.replace("/api/", "/") : url;

  return cleanUrl.startsWith("/")
    ? `${apiBaseUrl}${cleanUrl}`
    : `${apiBaseUrl}/uploads/${cleanUrl}`;
};

/**
 * Handles both:
 * - axios response: { data: <payload>, status, ... }
 * - custom wrapper: { success, data, message, ... }
 */
const unwrapApiResponse = (raw) => {
  if (raw && typeof raw === "object" && "success" in raw) return raw;
  if (raw && typeof raw === "object" && "data" in raw) {
    const payload = raw.data;
    if (payload && typeof payload === "object" && "success" in payload) return payload;
    return { success: true, data: payload };
  }
  return { success: false, data: null, message: "Invalid API response" };
};

/**
 * IMPORTANT FIX:
 * Your backend seems to return pagination fields at top-level:
 * { success, users:[], stats:{}, page, pages, total, count }
 *
 * So we must look for users at:
 * - data.users
 * - data.data (array)
 * - data.data.users
 */
const extractUsersPayload = (data) => {
  if (!data) return { list: [], stats: null, pages: 1 };

  // direct list
  if (Array.isArray(data)) return { list: data, stats: null, pages: 1 };

  // try common placements
  const list =
    (Array.isArray(data.users) && data.users) ||
    (Array.isArray(data.data) && data.data) ||
    (Array.isArray(data.results) && data.results) ||
    (Array.isArray(data?.data?.users) && data.data.users) ||
    [];

  const stats = data.stats || data?.data?.stats || null;

  // pages can be top-level or nested
  const pages =
    Number(data.pages) ||
    Number(data?.pagination?.pages) ||
    Number(data?.data?.pages) ||
    1;

  return { list, stats, pages };
};

const sortLatestFirst = (arr) =>
  [...arr].sort(
    (a, b) =>
      new Date(b?.createdAt || b?.updatedAt || 0) -
      new Date(a?.createdAt || a?.updatedAt || 0)
  );

/** ====================== UI ====================== */
const Avatar = ({ user, size = "md" }) => {
  const sizeClass = size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10 text-sm";
  const rawImage =
    user?.avatarPreview ||
    user?.profilePicture ||
    user?.avatarUrl ||
    user?.avatar ||
    user?.image;

  const src = normalizeImageUrl(rawImage);

  if (src) {
    return (
      <img
        src={src}
        alt={user?.name || "User"}
        crossOrigin="anonymous"
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white shadow-md`}
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${getAvatarColor(
        user?.name
      )} flex items-center justify-center rounded-full text-white font-bold ring-2 ring-white shadow-md`}
    >
      {user?.name?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
};

const StatsCard = ({ title, value, icon: Icon, gradient }) => (
  <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group">
    <div
      className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
    />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-lg ${gradient} bg-opacity-10 p-3`}>
          <Icon className="h-6 w-6 text-gray-900/70" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-gray-900 mb-1">{value ?? 0}</h3>
      <p className="text-sm font-medium text-gray-500">{title}</p>
    </div>
  </div>
);

const UserTableRow = ({ user, onEdit, onDelete, onToggleStatus }) => (
  <tr className="group border-b border-gray-50 transition-all hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent">
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} />
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">
            {user?.name || "—"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <FiMail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{user?.email || "—"}</span>
          </div>
        </div>
      </div>
    </td>

    <td className="px-6 py-4">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeStyle(
          user?.role
        )}`}
      >
        {user?.role === "admin" && <FiShield className="h-3 w-3" />}
        {(user?.role || "user").toUpperCase()}
      </span>
    </td>

    <td className="px-6 py-4">
      <div className="flex items-center gap-1.5 text-sm text-gray-600">
        <FiBriefcase className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="truncate">
          {user?.department || (
            <span className="italic text-gray-400">Not assigned</span>
          )}
        </span>
      </div>
    </td>

    <td className="px-6 py-4">
      <button
        onClick={() => onToggleStatus(user?._id, !!user?.isActive)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          user?.isActive
            ? "bg-green-500 focus:ring-green-500"
            : "bg-gray-300 focus:ring-gray-400"
        }`}
        type="button"
        aria-label={`Toggle ${user?.name || "user"} status`}
        disabled={!user?._id}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
            user?.isActive ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </td>

    <td className="px-6 py-4">
      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => onEdit(user)}
          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition-colors"
          title="Edit user"
          type="button"
        >
          <FiEdit3 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(user?._id)}
          className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors"
          title="Delete user"
          type="button"
          disabled={!user?._id}
        >
          <FiTrash2 className="h-4 w-4" />
        </button>
      </div>
    </td>
  </tr>
);

/** ====================== Modal (defined!) ======================
 * If you already have EditUserModal in another file, import it instead.
 * The key is: it MUST be defined/imported or you’ll get ReferenceError [web:58].
 */
const EditUserModal = ({ user, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "user",
    phone: user?.phone || "",
    department: user?.department || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ _id: user._id, ...form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="font-bold text-gray-900">Edit user</div>
          <button type="button" onClick={onClose} className="p-2">
            <FiX />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              type="email"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                className="w-full rounded-lg border px-3 py-2 bg-white"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="user">User</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={form.department}
              onChange={(e) =>
                setForm((p) => ({ ...p, department: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-2 font-semibold"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** ====================== Main ====================== */
const Users = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(currentPage));
    p.set("limit", "40");
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (activeTab !== "all") p.set("role", activeTab);
    return p.toString();
  }, [currentPage, activeTab, debouncedSearch]);

  useEffect(() => {
    let alive = true;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const raw = await apiClient.get(`/auth/users?${queryString}`);
        const res = unwrapApiResponse(raw);

        if (!res.success) throw new Error(res.message || "Failed to load users");

        // FIX: your users/stats/pages are probably on the same object (res), not inside res.data only.
        // So merge: take res.data if it’s an object, but keep top-level too.
        const mergedPayload =
          res?.data && typeof res.data === "object"
            ? { ...res, ...res.data }
            : res;

        const { list, stats: st, pages } = extractUsersPayload(mergedPayload);

        if (!alive) return;

        setUsers(sortLatestFirst(list));
        setStats(st || mergedPayload?.stats || null);
        setTotalPages(Number(pages) || 1);
      } catch (err) {
        if (!alive) return;
        toast.error(err?.message || "Failed to load users");
        setUsers([]);
        setStats(null);
        setTotalPages(1);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchUsers();
    return () => {
      alive = false;
    };
  }, [queryString]);

  const handleSaveUser = async (updated) => {
    try {
      const payload = {
        name: (updated.name || "").trim(),
        email: (updated.email || "").trim(),
        role: updated.role || "user",
        phone: (updated.phone || "").trim(),
        department: (updated.department || "").trim(),
      };

      const raw = await apiClient.put(`/auth/users/${updated._id}`, payload);
      const res = unwrapApiResponse(raw);
      if (!res.success) throw new Error(res.message || "Failed to update user");

      // backend might return updated user in res.data
      const updatedUser =
        res.data?.user || res.data || payload;

      setUsers((prev) =>
        prev.map((u) => (u._id === updated._id ? { ...u, ...updatedUser } : u))
      );

      toast.success("User updated successfully");
      setShowModal(false);
      setEditingUser(null);
    } catch (err) {
      toast.error(err?.message || "Failed to update user");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("⚠️ Delete this user? This cannot be undone.")) return;

    try {
      const raw = await apiClient.delete(`/auth/users/${id}`);
      const res = unwrapApiResponse(raw);
      if (!res.success) throw new Error(res.message || "Failed to delete user");

      setUsers((prev) => prev.filter((u) => u._id !== id));
      toast.success("User deleted successfully");
    } catch (err) {
      toast.error(err?.message || "Failed to delete user");
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const raw = await apiClient.put(`/auth/users/${id}`, {
        isActive: !currentStatus,
      });
      const res = unwrapApiResponse(raw);
      if (!res.success) throw new Error(res.message || "Failed to update status");

      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, isActive: !currentStatus } : u))
      );
      toast.success(`User ${!currentStatus ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const TabButton = ({ id, label, count }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative whitespace-nowrap px-4 pb-3 text-sm font-semibold transition-all ${
        activeTab === id ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
      }`}
      type="button"
    >
      {label}
      {typeof count === "number" && (
        <span
          className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            activeTab === id
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {count}
        </span>
      )}
      {activeTab === id && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-2 shadow-lg">
                <FiUsers className="h-6 w-6 text-white" />
              </div>
              User Management
            </h1>
            <p className="mt-2 text-gray-600">
              Manage user accounts, roles, and permissions
            </p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Users"
              value={stats.total}
              icon={FiUsers}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatsCard
              title="Active Users"
              value={stats.active}
              icon={FiUserCheck}
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
            <StatsCard
              title="Administrators"
              value={stats.admins}
              icon={FiShield}
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <StatsCard
              title="Inactive"
              value={stats.inactive}
              icon={FiUserX}
              gradient="bg-gradient-to-br from-red-500 to-red-600"
            />
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 bg-gray-50/50 p-5 space-y-4">
            <div className="flex gap-6 overflow-x-auto border-b border-gray-200 -mb-px scrollbar-hide">
              <TabButton id="all" label="All Users" count={stats?.total} />
              <TabButton id="admin" label="Admins" count={stats?.admins} />
              <TabButton id="staff" label="Staff" count={stats?.staff} />
              <TabButton id="user" label="Users" count={stats?.users} />
            </div>

            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 py-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100"
                  type="button"
                >
                  <FiX className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 text-xs font-bold uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="px-6 py-4 text-left">User</th>
                  <th className="px-6 py-4 text-left">Role</th>
                  <th className="px-6 py-4 text-left">Department</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {!loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="mb-4 rounded-full bg-gray-100 p-6">
                          <FiFilter className="h-10 w-10 text-gray-300" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900 mb-1">
                          No users found
                        </p>
                        <p className="text-sm text-gray-500">
                          Try adjusting your search or filters
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-200" />
                          <div className="space-y-2">
                            <div className="h-4 w-32 rounded bg-gray-200" />
                            <div className="h-3 w-24 rounded bg-gray-100" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-20 rounded-full bg-gray-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-28 rounded bg-gray-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-11 rounded-full bg-gray-200" />
                      </td>
                      <td className="px-6 py-4" />
                    </tr>
                  ))
                ) : (
                  users.map((user) => (
                    <UserTableRow
                      key={user._id}
                      user={user}
                      onEdit={(u) => {
                        setEditingUser(u);
                        setShowModal(true);
                      }}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                type="button"
              >
                <FiChevronLeft className="h-4 w-4" /> Previous
              </button>

              <div className="text-sm text-gray-600">
                Page <span className="font-bold text-gray-900">{currentPage}</span>{" "}
                of <span className="font-bold text-gray-900">{totalPages}</span>
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                type="button"
              >
                Next <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default Users;
