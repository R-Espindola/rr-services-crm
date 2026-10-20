'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ServiceBooking } from './page'

interface BookingDetailsModalProps {
  booking: ServiceBooking
  onClose: () => void
  onRefresh: () => void
}

export default function BookingDetailsModal({
  booking,
  onClose,
  onRefresh
}: BookingDetailsModalProps) {
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editStatus, setEditStatus] = useState<ServiceBooking['status']>('pending')
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (booking) {
      const dateObj = new Date(booking.scheduled_date)
      if (!isNaN(dateObj.getTime())) {
        setEditDate(dateObj.toISOString().split('T')[0])
        setEditTime(dateObj.toTimeString().substring(0, 5))
      }
      setEditStatus(booking.status)
    }
  }, [booking])

  const handleUpdate = async () => {
    setUpdating(true)
    setErrorMsg(null)

    try {
      const newDateTime = new Date(`${editDate}T${editTime}:00`).toISOString()

      const { error } = await supabase
        .from('orders')
        .update({
          scheduled_date: newDateTime,
          status: editStatus
        })
        .eq('id', booking.id)

      if (error) {
        setErrorMsg(`Erro Supabase: ${error.message}`)
        setUpdating(false)
        return
      }

      await onRefresh()
      onClose()
    } catch (err: any) {
      setErrorMsg(`Erro inesperado: ${err.message || String(err)}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Tem a certeza de que pretende eliminar este agendamento?')) {
      return
    }

    setDeleting(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', booking.id)

      if (error) {
        setErrorMsg(`Erro ao eliminar no Supabase: ${error.message}`)
        setDeleting(false)
        return
      }

      await onRefresh()
      onClose()
    } catch (err: any) {
      setErrorMsg(`Erro inesperado: ${err.message || String(err)}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
        <header className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-[#0B192C]">Editar / Detalhes do Agendamento</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
          >
            ✕
          </button>
        </header>

        {errorMsg && (
          <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-mono break-all">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase">Tipo de Serviço</span>
            <p className="text-base font-bold text-[#0B192C] mt-0.5">{booking.service_type}</p>
          </div>

          {/* Editar Data e Hora */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 border border-slate-200 rounded-xl">
            <div>
              <label htmlFor="modal-edit-date" className="block text-xs font-bold text-[#0B192C] uppercase mb-1">
                Data do Serviço
              </label>
              <input
                id="modal-edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#00D4FF]"
              />
            </div>

            <div>
              <label htmlFor="modal-edit-time" className="block text-xs font-bold text-[#0B192C] uppercase mb-1">
                Hora do Serviço
              </label>
              <input
                id="modal-edit-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#00D4FF]"
              />
            </div>
          </div>

          {/* Editar Estado */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label htmlFor="modal-edit-status" className="block text-xs font-bold text-[#0B192C] uppercase mb-1.5">
              Estado Atual
            </label>
            <select
              id="modal-edit-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as any)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#00D4FF]"
            >
              <option value="pending">🟡 Agendado / Pendente</option>
              <option value="in_progress">🔵 Em Execução</option>
              <option value="completed">🟢 Concluído</option>
              <option value="cancelled">🔴 Cancelado</option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase">Morada & Observações</span>
            <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 text-slate-600 text-xs leading-relaxed">
              {booking.notes || 'Sem observações adicionais registadas.'}
            </p>
          </div>
        </div>

        {/* Botões de Ação */}
        <footer className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
          <button
            type="button"
            disabled={deleting || updating}
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-xs hover:bg-rose-100 transition disabled:opacity-50 cursor-pointer"
          >
            {deleting ? 'A eliminar...' : '🗑️ Eliminar Serviço'}
          </button>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={updating || deleting}
              onClick={handleUpdate}
              className="px-5 py-2.5 rounded-xl bg-[#0B192C] text-white font-semibold text-xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              {updating ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}