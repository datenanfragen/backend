export const stripTags = (str: string) => str.replace(/<[^>]+>/gi, '');

export const generateReference = (date: Date) =>
    date.getFullYear() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase();
