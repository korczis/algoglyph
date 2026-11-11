import { binarySearch } from './search';
import { searchPlate } from './view';

export default searchPlate({
  id: 'binary-search',
  name: 'binary search',
  search: binarySearch,
  spread: 'uniform',
  palette: 'abyss',
});
