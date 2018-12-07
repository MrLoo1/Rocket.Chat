/* globals readMessage, menu */
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { Session } from 'meteor/session';
import { Favico } from 'meteor/rocketchat:favico';
import { fireGlobalEvent } from 'meteor/rocketchat:ui';

const fetchSubscriptions = () => (
	ChatSubscription.find({
		open: true,
		hideUnreadStatus: { $ne: true },
	}, {
		fields: {
			unread: 1,
			alert: 1,
			rid: 1,
			t: 1,
			name: 1,
			ls: 1,
			unreadAlert: 1,
		},
	})
		.fetch()
);

// TODO: make it a helper
const getOpenRoomId = () => {
	let openedRoomId = undefined;
	Tracker.nonreactive(() => {
		if (['channel', 'group', 'direct'].includes(FlowRouter.getRouteName())) {
			openedRoomId = Session.get('openedRoom');
		}
	});

	return openedRoomId;
};

Meteor.startup(() => {
	Tracker.autorun(() => {
		const openedRoomId = getOpenRoomId();

		let unreadCount = 0;
		let unreadAlert = false;

		for (const subscription of fetchSubscriptions()) {
			fireGlobalEvent('unread-changed-by-subscription', subscription);

			if (subscription.alert || subscription.unread > 0) {
				// This logic is duplicated in /client/notifications/notification.coffee.
				const hasFocus = readMessage.isEnable();
				const subscriptionIsTheOpenedRoom = openedRoomId === subscription.rid;
				if (hasFocus && subscriptionIsTheOpenedRoom) {
					// The user has probably read all messages in this room.
					// TODO: readNow() should return whether it has actually marked the room as read.
					setTimeout(() => {
						readMessage.readNow();
					}, 500);
				}

				// Increment the total unread count.
				unreadCount += subscription.unread;
				if (subscription.alert === true && subscription.unreadAlert !== 'nothing') {
					const userUnreadAlert = RocketChat.getUserPreference(Meteor.userId(), 'unreadAlert');
					if (subscription.unreadAlert === 'all' || userUnreadAlert !== false) {
						unreadAlert = '•';
					}
				}
			}

			if (RoomManager.openedRooms[subscription.t + subscription.name]) {
				readMessage.refreshUnreadMark(subscription.rid);
			}
		}

		menu.updateUnreadBars();

		if (unreadCount > 0) {
			if (unreadCount > 999) {
				Session.set('unread', '999+');
			} else {
				Session.set('unread', unreadCount);
			}
		} else if (unreadAlert !== false) {
			Session.set('unread', unreadAlert);
		} else {
			Session.set('unread', '');
		}
	});
});

Meteor.startup(() => {
	const favicon = window.favico = new Favico({
		position: 'up',
		animation: 'none',
	});

	Tracker.autorun(() => {
		const siteName = RocketChat.settings.get('Site_Name') || '';

		const unread = Session.get('unread');
		fireGlobalEvent('unread-changed', unread);

		if (favicon) {
			favicon.badge(unread, {
				bgColor: typeof unread !== 'number' ? '#3d8a3a' : '#ac1b1b',
			});
		}

		document.title = unread === '' ? siteName : `(${ unread }) ${ siteName }`;
	});
});
