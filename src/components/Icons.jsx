import React from 'react';

export const PlusCircle = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>add_circle</span>
);

export const Explore = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>explore</span>
);

export const Bookmarks = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>bookmarks</span>
);

export const AutoAwesome = ({ className, fill }) => (
  <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}` }}>auto_awesome</span>
);

export const Settings = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>settings</span>
);

export const Search = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>search</span>
);

export const Notifications = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>notifications</span>
);

export const AccountCircle = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>account_circle</span>
);

export const Person = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>person</span>
);

export const Movie = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>movie</span>
);

export const ArrowUpward = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>arrow_upward</span>
);

export const AttachFile = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>attach_file</span>
);

export const Close = ({ className }) => (
  <span className={`material-symbols-outlined ${className}`}>close</span>
);

export const Star = ({ className, fill }) => (
  <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}` }}>star</span>
);
