function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function defaultDateRange() {
  const today = new Date();

  return {
    start: '2026-07-13',
    end: formatDateInputValue(today),
  };
}
