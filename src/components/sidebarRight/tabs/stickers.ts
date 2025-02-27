/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import { SliderSuperTab } from "../../slider";
import InputSearch from "../../inputSearch";
import LazyLoadQueue from "../../lazyLoadQueue";
import appImManager from "../../../lib/appManagers/appImManager";
import appStickersManager from "../../../lib/appManagers/appStickersManager";
import PopupStickers from "../../popups/stickers";
import animationIntersector from "../../animationIntersector";
import { RichTextProcessor } from "../../../lib/richtextprocessor";
import { wrapSticker } from "../../wrappers";
import appSidebarRight from "..";
import { StickerSet, StickerSetCovered } from "../../../layer";
import { forEachReverse } from "../../../helpers/array";
import { i18n } from "../../../lib/langPack";
import findUpClassName from "../../../helpers/dom/findUpClassName";
import { attachClickEvent } from "../../../helpers/dom/clickEvent";

export default class AppStickersTab extends SliderSuperTab {
  private inputSearch: InputSearch;
  private setsDiv: HTMLDivElement;
  private lazyLoadQueue: LazyLoadQueue;

  protected init() {
    this.container.id = 'stickers-container';
    this.container.classList.add('chatlist-container');

    this.lazyLoadQueue = new LazyLoadQueue();

    this.inputSearch = new InputSearch('StickersTab.SearchPlaceholder', (value) => {
      this.search(value);
    });

    this.title.replaceWith(this.inputSearch.container);

    this.setsDiv = document.createElement('div');
    this.setsDiv.classList.add('sticker-sets');
    this.scrollable.append(this.setsDiv);

    attachClickEvent(this.setsDiv, (e) => {
      const sticker = findUpClassName(e.target, 'sticker-set-sticker');
      if(sticker) {
        const docId = sticker.dataset.docId;
        appImManager.chat.input.sendMessageWithDocument(docId);
        return;
      }

      const target = findUpClassName(e.target, 'sticker-set');
      if(!target) return;

      const id = target.dataset.stickerSet as string;
      const access_hash = target.dataset.access_hash as string;

      const button = findUpClassName(e.target, 'sticker-set-button') as HTMLElement;
      if(button) {
        e.preventDefault();
        e.cancelBubble = true;

        button.setAttribute('disabled', 'true');
        
        appStickersManager.getStickerSet({id, access_hash}).then(full => {
          appStickersManager.toggleStickerSet(full.set).then(changed => {
            if(changed) {
              button.textContent = '';
              button.append(i18n(full.set.installed_date ? 'Stickers.SearchAdded' : 'Stickers.SearchAdd'));
              button.classList.toggle('gray', !!full.set.installed_date);
            }
          }).finally(() => {
            //button.style.width = set.installed_date ? '68px' : '52px';
            button.removeAttribute('disabled');
          });
        });
      } else {
        appStickersManager.getStickerSet({id, access_hash}).then(full => {
          new PopupStickers(full.set).show();
        });
      }
    }, {listenerSetter: this.listenerSetter});
  }

  public onCloseAfterTimeout() {
    this.setsDiv.innerHTML = '';
    animationIntersector.checkAnimations(undefined, 'STICKERS-SEARCH');
    return super.onCloseAfterTimeout();
  }

  public renderSet(set: StickerSet.stickerSet) {
    //console.log('renderSet:', set);
    const div = document.createElement('div');
    div.classList.add('sticker-set');

    const header = document.createElement('div');
    header.classList.add('sticker-set-header');

    const details = document.createElement('div');
    details.classList.add('sticker-set-details');
    details.innerHTML = `
      <div class="sticker-set-name">${RichTextProcessor.wrapEmojiText(set.title)}</div>
    `;

    const countDiv = document.createElement('div');
    countDiv.classList.add('sticker-set-count');
    countDiv.append(i18n('Stickers', [set.count]));
    details.append(countDiv);
    
    const button = document.createElement('button');
    button.classList.add('btn-primary', 'btn-color-primary', 'sticker-set-button');
    button.append(i18n(set.installed_date ? 'Stickers.SearchAdded' : 'Stickers.SearchAdd'));
   // button.style.width = set.installed_date ? '68px' : '52px';

    if(set.installed_date) {
      button.classList.add('gray');
    }

    //ripple(button);

    header.append(details, button);

    const stickersDiv = document.createElement('div');
    stickersDiv.classList.add('sticker-set-stickers');

    const count = Math.min(5, set.count);
    for(let i = 0; i < count; ++i) {
      const stickerDiv = document.createElement('div');
      stickerDiv.classList.add('sticker-set-sticker');

      stickersDiv.append(stickerDiv);
    }

    appStickersManager.getStickerSet(set).then(set => {
      //console.log('renderSet got set:', set);
      
      for(let i = 0; i < count; ++i) {
        const div = stickersDiv.children[i] as HTMLDivElement;
        const doc = set.documents[i];
        if(doc._ === 'documentEmpty') {
          continue;
        }

        wrapSticker({
          doc, 
          div, 
          lazyLoadQueue: this.lazyLoadQueue, 
          group: 'STICKERS-SEARCH', 
          /* play: false,
          loop: false, */
          play: true,
          loop: true,
          width: 68,
          height: 68
        });
      }
    });

    /* const onMouseOver = () => {
      const animations: AnimationItem['animation'][] = [];
      for(let i = 0; i < count; ++i) {
        const stickerDiv = stickersDiv.children[i] as HTMLElement;
        const animationItem = animationIntersector.getAnimation(stickerDiv);
        if(!animationItem) continue;

        const animation = animationItem.animation;

        animations.push(animation);
        animation.loop = true;
        animation.play();
      }

      div.addEventListener('mouseout', () => {
        animations.forEach(animation => {
          animation.loop = false;
        });

        div.addEventListener('mouseover', onMouseOver, {once: true});
      }, {once: true});
    };

    div.addEventListener('mouseover', onMouseOver, {once: true}); */

    div.dataset.stickerSet = set.id;
    div.dataset.access_hash = set.access_hash;
    div.dataset.title = set.title;

    div.append(header, stickersDiv);

    this.setsDiv.append(div);
  }

  public open() {
    const ret = super.open();
    appSidebarRight.toggleSidebar(true).then(() => {
      this.renderFeatured();
    });

    return ret;
  }

  public renderFeatured() {
    return appStickersManager.getFeaturedStickers().then(coveredSets => {
      if(this.inputSearch.value) {
        return;
      }

      coveredSets = this.filterRendered('', coveredSets);
      coveredSets.forEach(set => {
        this.renderSet(set.set);
      });
    });
  }

  private filterRendered(query: string, coveredSets: StickerSetCovered[]) {
    coveredSets = coveredSets.slice();

    const children = Array.from(this.setsDiv.children) as HTMLElement[];
    forEachReverse(children, el => {
      const id = el.dataset.stickerSet;
      const index = coveredSets.findIndex(covered => covered.set.id === id);
  
      if(index !== -1) {
        coveredSets.splice(index, 1);
      } else if(!query || !el.dataset.title.toLowerCase().includes(query.toLowerCase())) {
        el.remove();
      }
    });

    animationIntersector.checkAnimations(undefined, 'STICKERS-SEARCH');

    return coveredSets;
  }

  public search(query: string) {
    if(!query) {
      return this.renderFeatured();
    }

    return appStickersManager.searchStickerSets(query, false).then(coveredSets => {
      if(this.inputSearch.value !== query) {
        return;
      }

      //console.log('search result:', coveredSets);

      coveredSets = this.filterRendered(query, coveredSets);
      coveredSets.forEach(set => {
        this.renderSet(set.set);
      });
    });
  }
}
