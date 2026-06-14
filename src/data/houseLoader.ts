import type { SalavatHouseRecord } from './salavatDistrictHouseSourceSummary';

// Нативная (и дефолтная для tsc) загрузка справочника домов.
// Массив остаётся отдельным модулем и подгружается асинхронным чанком, поэтому
// не выполняется тяжёлый map при старте. На web этот файл заменяется houseLoader.web.ts,
// где данные берутся отдельным JSON-ассетом и вовсе не попадают в JS-бандл.
export async function loadHouseRecords(): Promise<SalavatHouseRecord[]> {
  const module = await import('./salavatDistrictHouses');

  return module.salavatDistrictHouses;
}
