import { binarySearch } from '../_shared/sorted-search/search';
import { searchPlate } from '../_shared/sorted-search/view';

export default searchPlate({
  id: 'binary-search',
  name: 'binary search',
  search: binarySearch,
  spread: 'uniform',
  palette: 'abyss',
});
