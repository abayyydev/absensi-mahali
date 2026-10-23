import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

// Custom mixin for toast notifications (top-end)
export const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
  customClass: {
    popup: 'rounded-2xl border border-slate-200/80 shadow-xl font-sans',
  },
});

export function notifySuccess(title: string, text?: string) {
  return Toast.fire({
    icon: 'success',
    title,
    text,
  });
}

export function notifyError(title: string, text?: string) {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Tutup',
    confirmButtonColor: '#173B70',
    customClass: {
      popup: 'rounded-3xl border border-slate-200 shadow-2xl font-sans',
      confirmButton: 'rounded-xl px-5 py-2.5 font-semibold text-sm',
    },
  });
}

export async function confirmDialog(options: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}): Promise<boolean> {
  const result = await Swal.fire({
    icon: options.isDanger ? 'warning' : 'question',
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Ya, lanjutkan',
    cancelButtonText: options.cancelText ?? 'Batal',
    confirmButtonColor: options.isDanger ? '#b42318' : '#173B70',
    cancelButtonColor: '#94a3b8',
    reverseButtons: true,
    focusCancel: options.isDanger,
    customClass: {
      popup: 'rounded-3xl border border-slate-200 shadow-2xl font-sans p-6',
      confirmButton: 'rounded-xl px-5 py-2.5 font-semibold text-sm shadow-sm',
      cancelButton: 'rounded-xl px-5 py-2.5 font-semibold text-sm',
    },
  });

  return result.isConfirmed;
}

export async function promptVoid(mahaliName: string): Promise<string | null> {
  const result = await Swal.fire({
    title: 'Koreksi Check-in',
    text: `Masukkan alasan koreksi check-in untuk ${mahaliName}:`,
    input: 'textarea',
    inputPlaceholder: 'Tuliskan alasan koreksi (minimal 3 karakter)...',
    inputAttributes: {
      'aria-label': 'Alasan koreksi',
      rows: '3',
    },
    showCancelButton: true,
    confirmButtonText: 'Simpan Koreksi',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#b42318',
    cancelButtonColor: '#94a3b8',
    reverseButtons: true,
    preConfirm: (value) => {
      if (!value || value.trim().length < 3) {
        Swal.showValidationMessage('Alasan koreksi minimal 3 karakter.');
        return false;
      }
      return value.trim();
    },
    customClass: {
      popup: 'rounded-3xl border border-slate-200 shadow-2xl font-sans p-6',
      input: 'rounded-xl border border-slate-300 text-sm p-3 focus:ring-2 focus:ring-blue-700 focus:outline-none',
      confirmButton: 'rounded-xl px-5 py-2.5 font-semibold text-sm shadow-sm',
      cancelButton: 'rounded-xl px-5 py-2.5 font-semibold text-sm',
    },
  });

  if (result.isConfirmed && result.value) {
    return result.value as string;
  }
  return null;
}
