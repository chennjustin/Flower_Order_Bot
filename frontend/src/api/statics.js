import { api } from './client'

export const fetchStaticData = async () => {
  // if (isDevelopment) {
  //   return await mockApi.getStats()
  // }
  
  const res = await api.get(`/stats`)
  return res.data
}