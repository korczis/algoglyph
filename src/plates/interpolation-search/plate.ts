import { binarySearch } from '../_shared/sorted-search/search';
import { searchPlate } from '../_shared/sorted-search/view';
import { interpolationSearch } from './interpolate';

export default searchPlate({
  id: 'interpolation-search',
  name: 'interpolation search',
  search: interpolationSearch,
  compare: { name: 'binary search', search: binarySearch },
  spread: 'uniform',
  palette: 'ember',
});
