/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import type { Poll } from "../../lib/appManagers/appPollsManager";
import type Chat from "../chat/chat";
import PopupElement from ".";
import CheckboxField from "../checkboxField";
import InputField from "../inputField";
import RadioField from "../radioField";
import Scrollable from "../scrollable";
import SendContextMenu from "../chat/sendContextMenu";
import I18n, { _i18n } from "../../lib/langPack";
import findUpTag from "../../helpers/dom/findUpTag";
import { cancelEvent } from "../../helpers/dom/cancelEvent";
import getRichValue from "../../helpers/dom/getRichValue";
import isInputEmpty from "../../helpers/dom/isInputEmpty";
import whichChild from "../../helpers/dom/whichChild";

const MAX_LENGTH_QUESTION = 255;
const MAX_LENGTH_OPTION = 100;
const MAX_LENGTH_SOLUTION = 200;

export default class PopupCreatePoll extends PopupElement {
  private questionInputField: InputField;
  private questions: HTMLElement;
  private scrollable: Scrollable;
  private tempId = 0;

  private anonymousCheckboxField: CheckboxField;
  private multipleCheckboxField: PopupCreatePoll['anonymousCheckboxField'];
  private quizCheckboxField: PopupCreatePoll['anonymousCheckboxField'];

  private correctAnswers: Uint8Array[];
  private quizSolutionField: InputField;
  private optionInputFields: InputField[];

  constructor(private chat: Chat) {
    super('popup-create-poll popup-new-media', null, {closable: true, withConfirm: 'Create', body: true});

    _i18n(this.title, 'NewPoll');

    this.questionInputField = new InputField({
      placeholder: 'AskAQuestion',
      label: 'AskAQuestion', 
      name: 'question', 
      maxLength: MAX_LENGTH_QUESTION
    });

    this.questionInputField.input.addEventListener('input', () => {
      this.handleChange();
    });

    this.optionInputFields = [];

    if(this.chat.type !== 'scheduled') {
      const sendMenu = new SendContextMenu({
        onSilentClick: () => {
          this.chat.input.sendSilent = true;
          this.send();
        },
        onScheduleClick: () => {
          this.chat.input.scheduleSending(() => {
            this.send();
          });
        },
        openSide: 'bottom-left',
        onContextElement: this.btnConfirm,
      });
  
      sendMenu.setPeerId(this.chat.peerId);

      this.header.append(sendMenu.sendMenu);
    }

    this.header.append(this.questionInputField.container);

    const hr = document.createElement('hr');
    const d = document.createElement('div');
    d.classList.add('caption');
    _i18n(d, 'PollOptions');

    this.questions = document.createElement('form');
    this.questions.classList.add('poll-create-questions');

    const dd = document.createElement('div');
    dd.classList.add('poll-create-settings');
    
    const settingsCaption = document.createElement('div');
    settingsCaption.classList.add('caption');
    _i18n(settingsCaption, 'Settings');

    if(!this.chat.appPeersManager.isBroadcast(this.chat.peerId)) {
      this.anonymousCheckboxField = new CheckboxField({
        text: 'NewPoll.Anonymous', 
        name: 'anonymous'
      });
      this.anonymousCheckboxField.input.checked = true;
      dd.append(this.anonymousCheckboxField.label);
    }
    
    this.multipleCheckboxField = new CheckboxField({
      text: 'NewPoll.MultipleChoice', 
      name: 'multiple'
    });
    this.quizCheckboxField = new CheckboxField({
      text: 'NewPoll.Quiz', 
      name: 'quiz'
    });

    this.multipleCheckboxField.input.addEventListener('change', () => {
      const checked = this.multipleCheckboxField.input.checked;
      this.quizCheckboxField.input.toggleAttribute('disabled', checked);
    });

    this.quizCheckboxField.input.addEventListener('change', () => {
      const checked = this.quizCheckboxField.input.checked;

      (Array.from(this.questions.children) as HTMLElement[]).map(el => {
        el.classList.toggle('radio-field', checked);
      });

      if(!checked) {
        this.correctAnswers = undefined;
        this.quizSolutionField.setValueSilently('');
      }

      quizElements.forEach(el => el.classList.toggle('hide', !checked));

      this.multipleCheckboxField.input.toggleAttribute('disabled', checked);
      this.handleChange();
    });

    dd.append(this.multipleCheckboxField.label, this.quizCheckboxField.label);

    const quizElements: HTMLElement[] = [];

    const quizSolutionCaption = document.createElement('div');
    quizSolutionCaption.classList.add('caption');
    _i18n(quizSolutionCaption, 'AccDescrQuizExplanation');

    const quizHr = document.createElement('hr');

    const quizSolutionContainer = document.createElement('div');
    quizSolutionContainer.classList.add('poll-create-questions');

    this.quizSolutionField = new InputField({
      placeholder: 'NewPoll.Explanation.Placeholder', 
      label: 'NewPoll.Explanation.Placeholder',
      name: 'solution',
      maxLength: MAX_LENGTH_SOLUTION
    });

    this.questionInputField.input.addEventListener('input', () => {
      this.handleChange();
    });

    const quizSolutionSubtitle = document.createElement('div');
    quizSolutionSubtitle.classList.add('subtitle');
    _i18n(quizSolutionSubtitle, 'AddAnExplanationInfo');

    quizSolutionContainer.append(this.quizSolutionField.container, quizSolutionSubtitle);

    quizElements.push(quizHr, quizSolutionCaption, quizSolutionContainer);
    quizElements.forEach(el => el.classList.add('hide'));

    this.body.parentElement.insertBefore(hr, this.body);
    this.body.append(d, this.questions, document.createElement('hr'), settingsCaption, dd, ...quizElements);

    this.btnConfirm.addEventListener('click', this.onSubmitClick);

    this.scrollable = new Scrollable(this.body);
    this.appendMoreField();

    this.onEscape = () => {
      return !this.getFilledAnswers().length;
    };

    this.handleChange();
  }

  private getFilledAnswers() {
    const answers = Array.from(this.questions.children).map((el, idx) => {
      const input = el.querySelector('.input-field-input') as HTMLElement;
      return input instanceof HTMLInputElement ? input.value : getRichValue(input, false).value;
    }).filter(v => !!v.trim());

    return answers;
  }

  private onSubmitClick = () => {
    this.send();
  };

  private validate() {
    const question = this.questionInputField.value;
    if(!question) {
      return false;
    }

    if(question.length > MAX_LENGTH_QUESTION) {
      return false;
    }

    if(this.quizCheckboxField.input.checked && !this.correctAnswers?.length) {
      return false;
    }

    const answers = this.getFilledAnswers();
    if(answers.length < 2) {
      return false;
    }
    
    const tooLongOption = answers.find(a => a.length > MAX_LENGTH_OPTION);
    if(tooLongOption) {
      return false;
    }

    const {value: quizSolution} = getRichValue(this.quizSolutionField.input, false);
    if(quizSolution.length > MAX_LENGTH_SOLUTION) {
      return false;
    }

    return true;
  }

  private handleChange() {
    const valid = this.validate();
    this.btnConfirm.toggleAttribute('disabled', !valid);
  }

  public send(force = false) {
    const question = this.questionInputField.value;

    const answers = this.getFilledAnswers();

    const {value: quizSolution, entities: quizSolutionEntities} = getRichValue(this.quizSolutionField.input);

    if(this.chat.type === 'scheduled' && !force) {
      this.chat.input.scheduleSending(() => {
        this.send(true);
      });
      
      return;
    }

    this.btnClose.click();
    this.btnConfirm.removeEventListener('click', this.onSubmitClick);

    //const randomID = [nextRandomInt(0xFFFFFFFF), nextRandomInt(0xFFFFFFFF)];
    //const randomIDS = bigint(randomID[0]).shiftLeft(32).add(bigint(randomID[1])).toString();

    const pFlags: Poll['pFlags'] = {};

    if(this.anonymousCheckboxField && !this.anonymousCheckboxField.input.checked) {
      pFlags.public_voters = true;
    }

    if(this.multipleCheckboxField.input.checked) {
      pFlags.multiple_choice = true;
    }

    if(this.quizCheckboxField.input.checked) {
      pFlags.quiz = true;
    }

    const poll: Poll = {
      _: 'poll',
      pFlags,
      question,
      answers: answers.map((value, idx) => {
        return {
          _: 'pollAnswer',
          text: value,
          option: new Uint8Array([idx])
        };
      }),
      id: undefined
    };
    //poll.id = randomIDS;

    const inputMediaPoll = this.chat.appPollsManager.getInputMediaPoll(poll, this.correctAnswers, quizSolution, quizSolutionEntities);

    //console.log('Will try to create poll:', inputMediaPoll);

    this.chat.appMessagesManager.sendOther(this.chat.peerId, inputMediaPoll, {
      threadId: this.chat.threadId,
      replyToMsgId: this.chat.input.replyToMsgId,
      scheduleDate: this.chat.input.scheduleDate,
      silent: this.chat.input.sendSilent
    });

    if(this.chat.input.helperType === 'reply') {
      this.chat.input.clearHelper();
    }

    this.chat.input.onMessageSent(false, false);
  }

  onInput = (e: Event) => {
    const target = e.target as HTMLInputElement;

    const radioLabel = findUpTag(target, 'LABEL');
    const isEmpty = isInputEmpty(target);
    if(!isEmpty) {
      target.parentElement.classList.add('is-filled');
      radioLabel.classList.remove('hidden-widget');
      radioLabel.firstElementChild.removeAttribute('disabled');
    }

    const isLast = !radioLabel.nextElementSibling;
    if(isLast && !isEmpty && this.questions.childElementCount < 10) {
      this.appendMoreField();
    }

    this.handleChange();
  };

  onDeleteClick = (e: MouseEvent) => {
    const target = e.target as HTMLSpanElement;
    const label = findUpTag(target, 'LABEL');
    const idx = whichChild(label);

    if(this.correctAnswers && this.correctAnswers[0][0] === idx) {
      this.correctAnswers = undefined;
    }

    label.remove();
    this.optionInputFields.splice(idx, 1);

    this.optionInputFields.forEach((inputField, idx) => {
      inputField.options.labelOptions.length = 0;
      inputField.options.labelOptions.push(idx + 1);
      const i18nElement = I18n.weakMap.get(inputField.label.firstElementChild as HTMLElement);
      i18nElement.update();
    });

    this.handleChange();
  };

  private appendMoreField() {
    const tempId = this.tempId++;
    const idx = this.questions.childElementCount + 1;
    const questionField = new InputField({
      placeholder: 'NewPoll.OptionsAddOption', 
      label: 'NewPoll.OptionLabel',
      labelOptions: [idx],
      name: 'question-' + tempId, 
      maxLength: MAX_LENGTH_OPTION
    });
    questionField.input.addEventListener('input', this.onInput);

    const radioField = new RadioField({
      text: '', 
      name: 'question'
    });
    radioField.main.append(questionField.container);
    questionField.input.addEventListener('click', cancelEvent);
    radioField.label.classList.add('hidden-widget');
    radioField.input.disabled = true;
    if(!this.quizCheckboxField.input.checked) {
      radioField.label.classList.remove('radio-field');
    }
    radioField.input.addEventListener('change', () => {
      const checked = radioField.input.checked;
      if(checked) {
        const idx = whichChild(radioField.label);
        this.correctAnswers = [new Uint8Array([idx])];
        this.handleChange();
      }
    });

    const deleteBtn = document.createElement('span');
    deleteBtn.classList.add('btn-icon', 'tgico-close');
    questionField.container.append(deleteBtn);
  
    deleteBtn.addEventListener('click', this.onDeleteClick, {once: true});

    this.questions.append(radioField.label);

    this.scrollable.scrollIntoViewNew(this.questions.lastElementChild as HTMLElement, 'center');
    //this.scrollable.scrollTo(this.scrollable.scrollHeight, 'top', true, true);

    this.optionInputFields.push(questionField);
  }
}
