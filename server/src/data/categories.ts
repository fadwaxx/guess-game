import { GameCategory, GameItem } from '../types';
import { animalsItems } from './animals';
import { countriesItems } from './countries';
import { foodItems } from './food';
import { sportsItems } from './sports';
import { vehiclesItems } from './vehicles';
import { fruitsItems } from './fruits';
import { objectsItems } from './objects';
import { professionsItems } from './professions';
import { landmarksItems } from './landmarks';

// سجل الفئات المركزي. إضافة أي فئة هنا يجعلها تظهر تلقائيًا في إعدادات الغرفة.
export const ALL_CATEGORIES: GameCategory[] = [
  { id: 'animals', nameAr: 'الحيوانات', nameEn: 'Animals', icon: '🐾', items: animalsItems },
  { id: 'countries', nameAr: 'البلدان', nameEn: 'Countries', icon: '🌍', items: countriesItems },
  { id: 'food', nameAr: 'الأطعمة', nameEn: 'Food', icon: '🍽️', items: foodItems },
  { id: 'sports', nameAr: 'الرياضات', nameEn: 'Sports', icon: '🏆', items: sportsItems },
  { id: 'vehicles', nameAr: 'المركبات', nameEn: 'Vehicles', icon: '🚘', items: vehiclesItems },
  { id: 'fruits', nameAr: 'الفواكه والخضار', nameEn: 'Fruits & Vegetables', icon: '🍎', items: fruitsItems },
  { id: 'objects', nameAr: 'الأشياء اليومية', nameEn: 'Everyday Objects', icon: '🧩', items: objectsItems },
  { id: 'professions', nameAr: 'المهن', nameEn: 'Professions', icon: '👩‍💼', items: professionsItems },
  { id: 'landmarks', nameAr: 'المعالم', nameEn: 'Landmarks', icon: '🏛️', items: landmarksItems },
];

export function getCategoryById(categoryId: string): GameCategory | undefined {
  return ALL_CATEGORIES.find((c) => c.id === categoryId);
}

export function getItemById(categoryId: string, itemId: string): GameItem | undefined {
  return getCategoryById(categoryId)?.items.find((i) => i.id === itemId);
}

export function getRandomItem(categoryId: string, excludeItemIds: string[] = []): GameItem {
  const category = getCategoryById(categoryId);
  if (!category || category.items.length === 0) throw new Error(`الفئة غير موجودة أو فارغة: ${categoryId}`);
  const candidates = category.items.filter((i) => !excludeItemIds.includes(i.id));
  const pool = candidates.length > 0 ? candidates : category.items;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getAllAcceptedNames(item: GameItem): string[] {
  return [item.nameAr, ...item.aliasesAr];
}
