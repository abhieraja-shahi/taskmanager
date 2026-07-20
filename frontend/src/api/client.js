import axios from 'axios'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/* ─── Auth ──────────────────────────────────────────────────────────── */
export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)
export const updateUserRole = (userId, role) => api.put(`/auth/users/${userId}/role`, { role })
export const deleteUser = (userId) => api.delete(`/auth/users/${userId}`)
export const getUsers = () => api.get('/auth/users')
export const searchUsers = (q) => api.get('/auth/users/search', { params: { q } })
export const changePassword = (data) => api.post('/auth/change-password', data)

/* ─── Tasks ─────────────────────────────────────────────────────────── */
export const getTasks = (params) => api.get('/tasks/', { params })
export const getTask = (id) => api.get(`/tasks/${id}`)
export const createTask = (data) => api.post('/tasks/', data)
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data)
export const reassignTask = (id, data) => api.put(`/tasks/${id}/assignments`, data)
export const acceptTask = (id) => api.post(`/tasks/${id}/accept`)
export const rejectTask = (id, data) => api.post(`/tasks/${id}/reject`, data)
export const completeTask = (id) => api.post(`/tasks/${id}/complete`)
export const reviewTask = (id, data) => api.post(`/tasks/${id}/review`, data)
export const getTaskComments = (id) => api.get(`/tasks/${id}/comments`)
export const addComment = (id, data) => api.post(`/tasks/${id}/comments`, data)
export const getTaskActivity = (id) => api.get(`/tasks/${id}/activity`)

/* ─── Dashboard ─────────────────────────────────────────────────────── */
export const getManagerDashboard = (params) => api.get('/dashboard/manager', { params })
export const getUserDashboard = () => api.get('/dashboard/user')

/* ─── Teams ─────────────────────────────────────────────────────────── */
export const getTeams = () => api.get('/teams/')
export const createTeam = (data) => api.post('/teams/', data)
export const deleteTeam = (id) => api.delete(`/teams/${id}`)
export const addTeamMembers = (id, data) => api.post(`/teams/${id}/members`, data)
export const removeTeamMember = (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`)
export const addTeamManagers = (teamId, userIds) => api.post(`/teams/${teamId}/managers`, { user_ids: userIds })
export const removeTeamManager = (teamId, userId) => api.delete(`/teams/${teamId}/managers/${userId}`)

/* ─── Banks ──────────────────────────────────────────────────────────── */
export const getBanks = () => api.get('/banks/')
export const createBank = (data) => api.post('/banks/', data)
export const updateBank = (id, data) => api.put(`/banks/${id}`, data)
export const deleteBank = (id) => api.delete(`/banks/${id}`)

/* ─── Assignments ────────────────────────────────────────────────────── */
export const getMyAssignments = () => api.get('/assignments/my')
export const getAllAssignments = () => api.get('/assignments/all')

/* ─── Notifications ──────────────────────────────────────────────────── */
export const getNotifications = () => api.get('/notifications/')
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.put('/notifications/read-all')

/* ─── Attachments ──────────────────────────────────────────────────── */
export const getTaskAttachments = (taskId) => api.get(`/tasks/${taskId}/attachments`)
export const uploadTaskAttachment = (taskId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/tasks/${taskId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const downloadAttachment = (attachmentId) =>
  api.get(`/attachments/${attachmentId}/download`, { responseType: 'blob' })
export const deleteAttachment = (attachmentId) => api.delete(`/attachments/${attachmentId}`)

/* ─── Activity Log ───────────────────────────────────────────────────── */
export const getActivityLogs = (params) => api.get('/activity/', { params })

/* ─── Deployments ───────────────────────────────────────────────────── */
export const getDeployments = (params) => api.get('/deployments/', { params })
export const createDeployment = (data) => api.post('/deployments/', data)
export const uploadDeploymentScript = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/deployments/${id}/script`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const deleteDeployment = (id) => api.delete(`/deployments/${id}`)

/* ─── Zammad Tickets ─────────────────────────────────────────────────── */
export const getZammadTickets = (params) => api.get('/zammad/tickets', { params })
export const getTicketTasks   = (ticketId) => api.get(`/zammad/tickets/${ticketId}/tasks`)

export default api
