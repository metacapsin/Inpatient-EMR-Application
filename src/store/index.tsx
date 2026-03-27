import { combineReducers, configureStore } from '@reduxjs/toolkit';
import themeConfigSlice from './themeConfigSlice';
import authSlice from './authSlice';

const rootReducer = combineReducers({
    themeConfig: themeConfigSlice,
    auth: authSlice,
});

const store = configureStore({
    reducer: rootReducer,
});

export default store;
export type IRootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
