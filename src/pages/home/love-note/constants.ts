/**
 * 一言 Hitokoto v1（https://developer.hitokoto.cn/sentence/）
 * 官方句子类型中无单独「恋爱」分类（k 为哲学），此处用多分类组合以偏情感/台词向内容。
 */
export const HITOKOTO_API = 'https://v1.hitokoto.cn/';

/** @type {readonly string[]} 动画、文学、影视、来自网络 */
export const HITOKOTO_CATEGORIES = ['a', 'd', 'h', 'f'];

export const HITOKOTO_STORAGE_KEY = 'momoya:daily-hitokoto';
