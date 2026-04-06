import { api } from './client'

export const fetchOrders = async () => {
  // if (isDevelopment) {
  //   const response = await mockApi.getOrders()
  //   return response.orders
  // }
  
  const res = await api.get(`/orders`)
  return res.data
}

export const createOrder_FromDraft = async (room_id) => {
  const res = await api.post(`/order/${room_id}`)
  return res.data
}

export const updateOrder = async (room_id, order_draft) => {
  const res = await api.patch(`/order/${room_id}`, order_draft)
  return res.data
}

export const deleteOrder = async (order_id) => {
  const res = await api.delete(`/order/${order_id}`)
  return res.data
}

export const fetchOrderDraft = async (room_id) => {
  const res = await api.patch(`/organize_data/${room_id}`)
  return res.data
}

export const sendOrderDraft = async (room_id, order_draft) => {
  const res = await api.patch(`/orderdraft/${room_id}`, order_draft)
  return res.data
}



export const readOrderDraft = async (room_id) => {
  console.log('Reading order draft for room:', room_id)
  try {
    const res = await api.get(`/orderdraft/${room_id}`)
    console.log('Order draft read response:', res.data)
    return res.data
  } catch (error) {
    console.error('Error in readOrderDraft:', error)
    throw error
  }
}

export const exportDocx = async (order_id) => {
  try {
    const res = await api.get(`/orders/${order_id}.docx`, {
      responseType: 'blob' // Important for downloading files
    })
    return res.data
  } catch (error) {
    console.error('Error exporting docx:', error)
    throw error
  }
}