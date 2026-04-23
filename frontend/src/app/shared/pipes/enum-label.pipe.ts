import { Pipe, PipeTransform } from '@angular/core';

import {
  categoryLabels,
  orderStatusLabels,
  orderTypeLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  reservationStatusLabels,
  roleLabels,
  tableStatusLabels
} from '../ui-labels';

const dictionaries = {
  category: categoryLabels,
  orderStatus: orderStatusLabels,
  orderType: orderTypeLabels,
  paymentMethod: paymentMethodLabels,
  paymentStatus: paymentStatusLabels,
  reservationStatus: reservationStatusLabels,
  role: roleLabels,
  tableStatus: tableStatusLabels
} as const;

type DictionaryKey = keyof typeof dictionaries;

@Pipe({
  name: 'enumLabel',
  standalone: true
})
export class EnumLabelPipe implements PipeTransform {
  transform(value: number | null | undefined, dictionary: DictionaryKey): string {
    if (!value) {
      return '';
    }

    return dictionaries[dictionary][value as never] ?? String(value);
  }
}
