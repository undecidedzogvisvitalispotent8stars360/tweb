/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import { MOUNT_CLASS_TO } from "../config/debug";

/**
 * Descend sorted storage
 */

type ItemType = number;

export enum SliceEnd {
  None = 0,
  Top = 1,
  Bottom = 2,
  Both = SliceEnd.Top | SliceEnd.Bottom
};

export interface Slice extends Array<ItemType> {
  //slicedArray: SlicedArray;
  end: SliceEnd;

  isEnd: (side: SliceEnd) => boolean;
  setEnd: (side: SliceEnd) => void;
  unsetEnd: (side: SliceEnd) => void;

  slice: (from?: number, to?: number) => Slice;
  splice: (start: number, deleteCount: number, ...items: ItemType[]) => Slice;
}

export interface SliceConstructor {
  new(...items: ItemType[]): Slice;
}

// TODO: Clear empty arrays after deleting items
export default class SlicedArray {
  private slices: Slice[]/*  = [[7,6,5],[4,3,2],[1,0,-1]] */;
  private sliceConstructor: SliceConstructor;
  
  constructor() {
    // @ts-ignore
    this.sliceConstructor = SlicedArray.getSliceConstructor(this);

    const first = this.constructSlice();
    //first.setEnd(SliceEnd.Bottom);
    this.slices = [first];
  }

  private static getSliceConstructor(slicedArray: SlicedArray) {
    return class Slice extends Array<ItemType> implements Slice {
      //slicedArray: SlicedArray;
      end: SliceEnd = SliceEnd.None;
  
      /* constructor(...items: ItemType[]) {
        super(...items);
        //this.slicedArray = slicedArray;
      } */
  
      isEnd(side: SliceEnd): boolean {
        if((this.end & side) === side) {
          return true;
        }/*  else if(!this.slicedArray) {
          return false;
        } */
  
        let isEnd = false;
        if(side === SliceEnd.Top) {
          const slice = slicedArray.last;
          isEnd = slice.end & side ? this.includes(slice[slice.length - 1])/*  || !slice.length */ : false;
        } else if(side === SliceEnd.Bottom) {
          const slice = slicedArray.first;
          isEnd = slice.end & side ? this.includes(slice[0])/*  || !slice.length */ : false;
        } else if(side === SliceEnd.Both) {
          return this.isEnd(SliceEnd.Top) && this.isEnd(SliceEnd.Bottom);
        }

        if(isEnd) {
          this.setEnd(side);
        }
  
        return isEnd;
      }
  
      setEnd(side: SliceEnd) {
        this.end |= side;
      }

      unsetEnd(side: SliceEnd) {
        this.end ^= side;
      }

      splice(start: number, deleteCount: number, ...items: ItemType[]) {
        const ret = super.splice(start, deleteCount, ...items);

        if(!this.length) {
          const slices = slicedArray.slices as number[][];
          const idx = slices.indexOf(this);
          if(idx !== -1) {
            if(slices.length === 1) { // left empty slice without ends
              this.unsetEnd(SliceEnd.Both);
            } else { // delete this slice
              slices.splice(idx, 1);
            }
          }
        }

        return ret;
      }
    }
  }

  public constructSlice(...items: ItemType[]) {
    //const slice = new Slice(this, ...items);
    // can't pass items directly to constructor because first argument is length
    const slice = new this.sliceConstructor(items.length);
    for(let i = 0, length = items.length; i < length; ++i) {
      slice[i] = items[i];
    }
    return slice;
    
    // ! code below will slow execution in 15 times
    /* const self = this;
    const p: Slice = new Proxy(slice, {
      get: function(target, name: any) {
        if(name === 'constructor') {
          const p = new Proxy(Slice, {
            construct: (target, args) => {
              return self.constructSlice(...args);
            }
          });

          return p;
        }

        return target[name];
      }
    });

    return p; */

    /*
    var p = slicedArray.constructSlice();
    p.length = 100000;
    p.fill(255);

    var a = new Array(100000);
    a.fill(255);

    var b = 0;
    var perf = performance.now();
    for(var i = 0; i < p.length; ++i) {
        b += p[i];
    }

    console.log('perf 1', performance.now() - perf);

    b = 0;
    perf = performance.now();
    for(var i = 0; i < a.length; ++i) {
        b += a[i];
    }

    console.log('perf 2', performance.now() - perf);
    */
  }

  public insertSlice(slice: ItemType[], flatten = true) {
    if(!slice.length) {
      return;
    }

    const first = this.slices[0];
    if(!first.length) {
      first.push(...slice);
      return first;
    }

    const lowerBound = slice[slice.length - 1];
    const upperBound = slice[0];

    let foundSlice: Slice, lowerIndex = -1, upperIndex = -1, foundSliceIndex = 0;
    for(; foundSliceIndex < this.slices.length; ++foundSliceIndex) {
      foundSlice = this.slices[foundSliceIndex];
      lowerIndex = foundSlice.indexOf(lowerBound);
      upperIndex = foundSlice.indexOf(upperBound);
      
      if(upperIndex !== -1 && -1 !== lowerIndex) {
        break;
      } else if(upperIndex !== -1 || -1 !== lowerIndex) {
        break;
      }
    }

    if(upperIndex !== -1 && -1 !== lowerIndex) {

    } else if(upperIndex !== -1) {  // ([1, 2, 3] | [1, 2, 3, 4, 5]) -> [1, 2, 3, 4, 5]
      const sliced = slice.slice(foundSlice.length - upperIndex);
      foundSlice.push(...sliced);
    } else if(lowerIndex !== -1) {  // ([1, 2, 3] | [-1, 0, 1]) -> [-1, 0, 1, 2, 3]
      const sliced = slice.slice(0, slice.length - lowerIndex - 1);
      foundSlice.unshift(...sliced);
    } else {
      let insertIndex = 0;
      for(const length = this.slices.length; insertIndex < length; ++insertIndex) { // * maybe should iterate from the end, could be faster ?
        const s = this.slices[insertIndex];
        if(slice[0] > s[0]) {
          break;
        }
      }

      this.slices.splice(insertIndex, 0, this.constructSlice(...slice));
      foundSliceIndex = insertIndex;
    }

    if(flatten) {
      return this.flatten(foundSliceIndex);
    }
  }

  private flatten(foundSliceIndex: number) {
    if(this.slices.length >= 2) {
      for(let i = 0, length = this.slices.length; i < (length - 1); ++i) {
        const prevSlice = this.slices[i];
        const nextSlice = this.slices[i + 1];
  
        const upperIndex = prevSlice.indexOf(nextSlice[0]);
        if(upperIndex !== -1) {
          prevSlice.setEnd(nextSlice.end);
          this.slices.splice(i + 1, 1);

          if(i < foundSliceIndex) {
            --foundSliceIndex;
          }

          --length; // respect array bounds
          --i;      // repeat from the same place
  
          this.insertSlice(nextSlice, false);
        }
      }
    }

    return this.slices[foundSliceIndex];
  }

  // * 
  
  get first() {
    return this.slices[0];
  }
  
  get last() {
    return this.slices[this.slices.length - 1];
  }

  get slice() {
    return this.first;
  }

  get length() {
    return this.slice.length;
  }

  public findSlice(item: ItemType) {
    for(let i = 0, length = this.slices.length; i < length; ++i) {
      const slice = this.slices[i];
      const index = slice.indexOf(item);
      if(index !== -1) {
        return {slice, index};
      }
    }
    
    return undefined;
  }

  public findSliceOffset(maxId: number) {
    let slice: Slice;
    for(let i = 0; i < this.slices.length; ++i) {
      let offset = 0;
      slice = this.slices[i];
      if(slice.length < 2) {
        continue;
      }
      
      for(; offset < slice.length; offset++) {
        if(maxId >= slice[offset]) {
          /* if(!offset) { // because can't find 3 in [[5,4], [2,1]]
            return undefined;
          } */

          return {
            slice, 
            offset: maxId === slice[offset] ? offset : offset - 1
          };
        }
      }
    }

    if(slice && slice.isEnd(SliceEnd.Top)) {
      return {
        slice,
        offset: slice.length
      };
    }

    return undefined;
  }

  // * https://core.telegram.org/api/offsets
  public sliceMe(offsetId: number, add_offset: number, limit: number) {
    let slice = this.slice;
    let offset = 0;
    let sliceOffset = 0;

    if(offsetId) {
      const pos = this.findSliceOffset(offsetId);
      if(!pos) {
        return undefined;
      }

      slice = pos.slice;
      offset = sliceOffset = pos.offset;

      if(slice.includes(offsetId)) {
        sliceOffset += 1;
      }

      /* if(slice.includes(offsetId) && add_offset < 0) {
        add_offset += 1;
      } */
    }

    let sliceStart = Math.max(sliceOffset + add_offset, 0);
    let sliceEnd = sliceOffset + add_offset + limit;
    //const fixHalfBackLimit = add_offset && !(limit / add_offset % 2) && (sliceEnd % 2) ? 1 : 0;
    //sliceEnd += fixHalfBackLimit;

    const sliced = slice.slice(sliceStart, sliceEnd) as Slice;

    const topWasMeantToLoad = add_offset < 0 ? limit + add_offset : limit;
    const bottomWasMeantToLoad = Math.abs(add_offset);

    // can use 'slice' here to check because if it's end, then 'sliced' is out of 'slice'
    // useful when there is only 1 message in chat on its reopening
    const topFulfilled = (slice.length - sliceOffset) >= topWasMeantToLoad || (slice.isEnd(SliceEnd.Top) ? (sliced.setEnd(SliceEnd.Top), true) : false);
    const bottomFulfilled = (sliceOffset - bottomWasMeantToLoad) >= 0 || (slice.isEnd(SliceEnd.Bottom) ? (sliced.setEnd(SliceEnd.Bottom), true) : false);

    //console.log('sliceMe', topFulfilled, bottomFulfilled);

    return {
      slice: sliced, 
      offsetIdOffset: offset,
      fulfilled: SliceEnd.None | (topFulfilled && bottomFulfilled ? SliceEnd.Both : ((topFulfilled ? SliceEnd.Top : SliceEnd.None) | (bottomFulfilled ? SliceEnd.Bottom : SliceEnd.None)))
    };
  }

  public unshift(...items: ItemType[]) {
    let slice = this.first;
    if(!slice.length) {
      slice.setEnd(SliceEnd.Bottom);
    } else if(!slice.isEnd(SliceEnd.Bottom)) {
      slice = this.constructSlice();
      slice.setEnd(SliceEnd.Bottom);
      this.slices.unshift(slice);
    }

    slice.unshift(...items);
  }

  public push(...items: ItemType[]) {
    let slice = this.last;
    if(!slice.length) {
      slice.setEnd(SliceEnd.Top);
    } else if(!slice.isEnd(SliceEnd.Top)) {
      slice = this.constructSlice();
      slice.setEnd(SliceEnd.Top);
      this.slices.push(slice);
    }

    slice.push(...items);
  }

  public delete(item: ItemType) {
    const found = this.findSlice(item);
    if(found) {
      found.slice.splice(found.index, 1);
      return true;
    }

    return false;
  }
}

MOUNT_CLASS_TO && (MOUNT_CLASS_TO.SlicedArray = SlicedArray);
