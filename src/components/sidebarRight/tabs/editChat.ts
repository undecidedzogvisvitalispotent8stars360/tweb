/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import { SliderSuperTab } from "../../slider"
import InputField from "../../inputField";
import EditPeer from "../../editPeer";
import { SettingSection } from "../../sidebarLeft";
import Row from "../../row";
import Button from "../../button";
import appChatsManager, { ChatRights } from "../../../lib/appManagers/appChatsManager";
import appProfileManager from "../../../lib/appManagers/appProfileManager";
import { Chat } from "../../../layer";
import AppChatTypeTab from "./chatType";
import rootScope from "../../../lib/rootScope";
import AppGroupPermissionsTab from "./groupPermissions";
import { i18n, LangPackKey } from "../../../lib/langPack";
import PopupDeleteDialog from "../../popups/deleteDialog";
import { addCancelButton } from "../../popups";
import PopupPeer from "../../popups/peer";
import { attachClickEvent } from "../../../helpers/dom/clickEvent";
import toggleDisability from "../../../helpers/dom/toggleDisability";

export default class AppEditChatTab extends SliderSuperTab {
  private chatNameInputField: InputField;
  private descriptionInputField: InputField;
  private editPeer: EditPeer;
  public chatId: number;

  protected async _init() {
    // * cleanup prev
    this.listenerSetter.removeAll();
    this.scrollable.container.innerHTML = '';

    this.container.classList.add('edit-peer-container', 'edit-group-container');
    this.setTitle('Edit');
    
    const chatFull = await appProfileManager.getChatFull(this.chatId, true);

    const chat: Chat.chat | Chat.channel = appChatsManager.getChat(this.chatId);
    const isBroadcast = appChatsManager.isBroadcast(this.chatId);
    const isChannel = appChatsManager.isChannel(this.chatId);

    {
      const section = new SettingSection({noDelimiter: true});
      const inputFields: InputField[] = [];

      const inputWrapper = document.createElement('div');
      inputWrapper.classList.add('input-wrapper');
  
      this.chatNameInputField = new InputField({
        label: isBroadcast ? 'Channel.ChannelNameHolder' : 'CreateGroup.NameHolder',
        name: 'chat-name',
        maxLength: 255
      });
      this.descriptionInputField = new InputField({
        label: 'DescriptionPlaceholder',
        name: 'chat-description',
        maxLength: 255
      });
      
      this.chatNameInputField.setOriginalValue(chat.title);
      this.descriptionInputField.setOriginalValue(chatFull.about);

      inputWrapper.append(this.chatNameInputField.container, this.descriptionInputField.container);
      
      inputFields.push(this.chatNameInputField, this.descriptionInputField);

      this.editPeer = new EditPeer({
        peerId: -this.chatId,
        inputFields,
        listenerSetter: this.listenerSetter
      });
      this.content.append(this.editPeer.nextBtn);

      section.content.append(this.editPeer.avatarEdit.container, inputWrapper);

      if(appChatsManager.hasRights(this.chatId, 'change_type')) {
        const chatTypeRow = new Row({
          titleLangKey: isBroadcast ? 'ChannelType' : 'GroupType',
          clickable: () => {
            const tab = new AppChatTypeTab(this.slider);
            tab.chatId = this.chatId;
            tab.chatFull = chatFull;
            tab.open();

            this.listenerSetter.add(tab.eventListener)('destroy', setChatTypeSubtitle);
          },
          icon: 'lock'
        });

        const setChatTypeSubtitle = () => {
          chatTypeRow.subtitle.textContent = '';

          let key: LangPackKey;
          if(isBroadcast) {
            key = (chat as Chat.channel).username ? 'TypePublic' : 'TypePrivate';
          } else {
            key = (chat as Chat.channel).username ? 'TypePublicGroup' : 'TypePrivateGroup';
          }

          chatTypeRow.subtitle.append(i18n(key));
        };

        setChatTypeSubtitle();
        section.content.append(chatTypeRow.container);
      }

      if(appChatsManager.hasRights(this.chatId, 'change_permissions') && !isBroadcast) {
        const flags = [
          'send_messages',
          'send_media',
          'send_stickers',
          'send_polls',
          'embed_links',
          'invite_users',
          'pin_messages',
          'change_info'
        ] as ChatRights[];

        const permissionsRow = new Row({
          titleLangKey: 'ChannelPermissions',
          clickable: () => {
            const tab = new AppGroupPermissionsTab(this.slider);
            tab.chatId = this.chatId;
            tab.open();
          },
          icon: 'permissions',
        });

        const setPermissionsLength = () => {
          permissionsRow.subtitle.innerHTML = flags.reduce((acc, f) => acc + +appChatsManager.hasRights(this.chatId, f, chat.default_banned_rights), 0) + '/' + flags.length;
        };

        setPermissionsLength();        
        section.content.append(permissionsRow.container);

        this.listenerSetter.add(rootScope)('chat_update', (chatId) => {
          if(this.chatId === chatId) {
            setPermissionsLength();
          }
        });
      }

      /* const administratorsRow = new Row({
        titleLangKey: 'PeerInfo.Administrators',
        subtitle: '' + ((chatFull as ChatFull.channelFull).admins_count || 1),
        icon: 'admin',
        clickable: true
      });

      section.content.append(administratorsRow.container); */

      this.scrollable.append(section.container);

      attachClickEvent(this.editPeer.nextBtn, () => {
        this.editPeer.nextBtn.disabled = true;
  
        let promises: Promise<any>[] = [];

        const id = this.chatId;
        if(this.chatNameInputField.isValid()) {
          promises.push(appChatsManager.editTitle(id, this.chatNameInputField.value));
        }

        if(this.descriptionInputField.isValid()) {
          promises.push(appChatsManager.editAbout(id, this.descriptionInputField.value));
        }

        if(this.editPeer.uploadAvatar) {
          promises.push(this.editPeer.uploadAvatar().then(inputFile => {
            return appChatsManager.editPhoto(id, inputFile);
          }));
        }
  
        Promise.race(promises).finally(() => {
          this.editPeer.nextBtn.removeAttribute('disabled');
          this.close();
        });
      }, {listenerSetter: this.listenerSetter});

      /*
      if(appChatsManager.hasRights(-this.peerId, 'change_info')) {
        const discussionRow = new Row({
          titleLangKey: 'PeerInfo.Discussion',
          subtitleLangKey: 'PeerInfo.Discussion.Add',
          clickable: true,
          icon: 'message'
        });

        section.content.append(discussionRow.container);
      }

      const administratorsRow = new Row({
        titleLangKey: 'PeerInfo.Administrators',
        subtitle: '' + chatFull.admins_count,
        icon: 'admin',
        clickable: true
      });

      section.content.append(administratorsRow.container);

      if(appChatsManager.hasRights(-this.peerId, 'change_info')) {
        const signMessagesCheckboxField = new CheckboxField({
          text: 'PeerInfo.SignMessages',
          checked: false
        });

        section.content.append(signMessagesCheckboxField.label);
      } */
    }

    /* {
      const section = new SettingSection({

      });

      const membersRow = new Row({
        titleLangKey: isBroadcast ? 'PeerInfo.Subscribers' : 'GroupMembers',
        icon: 'newgroup',
        clickable: true
      });

      membersRow.subtitle.append(i18n('Subscribers', [numberThousandSplitter(335356)]));

      section.content.append(membersRow.container);

      if(appChatsManager.hasRights(this.chatId, 'change_permissions')) {
        const showChatHistoryCheckboxField = new CheckboxField({
          text: 'Show chat history for new members',
          withRipple: true
        });
  
        if(appChatsManager.isChannel(this.chatId) && !(chatFull as ChatFull.channelFull).pFlags.hidden_prehistory) {
          showChatHistoryCheckboxField.checked = true;
        }
  
        section.content.append(showChatHistoryCheckboxField.label);
      }

      this.scrollable.append(section.container);
    } */

    if(appChatsManager.hasRights(this.chatId, 'delete_chat')) {
      const section = new SettingSection({});

      const btnDelete = Button('btn-primary btn-transparent danger', {icon: 'delete', text: isBroadcast ? 'PeerInfo.DeleteChannel' : 'DeleteMega'});

      attachClickEvent(btnDelete, () => {
        if(isBroadcast) {
          new PopupPeer('popup-delete-channel', {
            peerId: -this.chatId,
            titleLangKey: 'ChannelDeleteMenu',
            descriptionLangKey: 'AreYouSureDeleteAndExitChannel',
            buttons: addCancelButton([{
              langKey: 'ChannelDeleteMenu',
              callback: () => {
                const toggle = toggleDisability([btnDelete], true);
  
              },
              isDanger: true
            }, {
              langKey: 'DeleteChannelForAll',
              callback: () => {
                const toggle = toggleDisability([btnDelete], true);
  
                appChatsManager.deleteChannel(this.chatId).then(() => {
                  this.close();
                }, () => {
                  toggle();
                });
              },
              isDanger: true
            }])
          }).show();
        } else {
          new PopupDeleteDialog(-this.chatId, undefined, (promise) => {
            const toggle = toggleDisability([btnDelete], true);
            promise.then(() => {
              this.close();
            }, () => {
              toggle();
            });
          });
        }
      }, {listenerSetter: this.listenerSetter});

      section.content.append(btnDelete);

      this.scrollable.append(section.container);
    }

    if(!isChannel) {
      // ! this one will fire earlier than tab's closeAfterTimeout (destroy) event and listeners will be erased, so destroy won't fire
      this.listenerSetter.add(rootScope)('dialog_migrate', ({migrateFrom, migrateTo}) => {
        if(-this.chatId === migrateFrom) {
          this.chatId = -migrateTo;
          this._init();
        }
      });
    }
  }

  protected init() {
    return this._init();
  }
}
