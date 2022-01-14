import * as mocks from "./mockIterators.skip"
import * as tests from "./testIterators.skip"

type Collection = Iterable<any> & {
  keys(): Iterable<any>
  values(): Iterable<any>
  entries(): Iterable<[any, any]>
}

function testCollection(collection: Collection) {
  [
    tests.isIterable,
    tests.isNotAsyncIterable,
    tests.isNotIterator,
    tests.isNotAsyncIterator
  ].forEach(x => x(() => collection, collection))

  describe("keys()", () => {
    [
      tests.isIterable,
      tests.isNotAsyncIterable,
      tests.isIterator,
      tests.isNotAsyncIterator
    ].forEach(x => x(() => collection.keys(), collection.keys()))
  })
  
  describe("values()", () => {
    [
      tests.isIterable,
      tests.isNotAsyncIterable,
      tests.isIterator,
      tests.isNotAsyncIterator
    ].forEach(x => x(() => collection.values(), collection.values()))
  })
  
  describe("entries()", () => {
    [
      tests.isIterable,
      tests.isNotAsyncIterable,
      tests.isIterator,
      tests.isNotAsyncIterator
    ].forEach(x => x(() => collection.entries(), collection.entries()))
  })  
}

describe("Array", () => testCollection(mocks.list))
describe("Set", () => testCollection(new Set(mocks.list)))
describe("Map", () => testCollection(new Map(mocks.list.map(x => [x, x]))))
