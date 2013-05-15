var Featured = {
    connection: null,
    room: null,
    nickname: null,

    NS_MUC: "http://jabber.org/protocol/muc",

    joined: null,
    login_type: null,
    username: null,
    password: null,
    has_login: false,
    index: 0,
    flag: false,

    make_url: function() {
        return "groupie.html?" + Constant.login_type + "=" + Featured.login_type + "&" + Constant.username + "=" + Featured.username + "&" + Constant.password + "=" + Featured.password;
    },

    light_it: function() {
        console.log('light_it');
        $('#back').attr('href', Featured.make_url());
    },

    on_presence: function(presence) {
        console.log(presence);

        var from = $(presence).attr('from');
        var room = Strophe.getBareJidFromJid(from);

        // make sure this presence is for the right room
        if (room === Featured.room) {
            var nick = Strophe.getResourceFromJid(from);

            if ($(presence).attr('type') === 'error' && !Featured.joined) {
                // error joining room; reset app
                Featured.connection.disconnect();
            } else if (!Featured.participants[nick] && $(presence).attr('type') !== 'unavailable') {
                // add to participant list
                // var user_jid = $(presence).find('item').attr('jid');
                // Featured.participants[nick] = user_jid || true;
                // $('#participant-list').append('<li>' + nick + '</li>');

                if (Featured.joined) {
                    $(document).trigger('user_joined', nick);
                }
            } else if (Featured.participants[nick] && $(presence).attr('type') === 'unavailable') {
                // remove from participants list
                // $('#participant-list li').each(function () {
                //     if (nick === $(this).text()) {
                //         $(this).remove();
                //         return false;
                //     }
                // });

                $(document).trigger('user_left', nick);
            }

            if ($(presence).attr('type') !== 'error' && !Featured.joined) {
                // check for status 110 to see if it's our own presence
                if ($(presence).find("status[code='110']").length > 0) {
                    // check if server changed our nick
                    if ($(presence).find("status[code='210']").length > 0) {
                        Featured.nickname = Strophe.getResourceFromJid(from);
                    }

                    // room join complete
                    $(document).trigger("room_joined");
                }
            }
        }

        return true;
    },

    on_public_message: function(message) {
        console.log(message);

        var from = $(message).attr('from');
        var room = Strophe.getBareJidFromJid(from);
        var nick = Strophe.getResourceFromJid(from);

        // make sure message is from the right place
        if (room === Featured.room) {
            // is message from a user or the room itself?
            var notice = !nick;

            // messages from ourself will be styled differently
            var nick_class = "nick";
            if (nick === Featured.nickname) {
                nick_class += " self";
            }

            var body = $(message).children('body').text();

            console.log('body ' + body);
            console.log('index ' + Featured.index);
            Featured.index++;
            if (body == Constant.cleaner_message) {
                return true;
            }

            var delayed = $(message).children("delay").length > 0 || $(message).children("x[xmlns='jabber:x:delay']").length > 0;

            if (!notice) {
                var delay_css = delayed ? " delayed" : "";

                var action = body.match(/\/me (.*)$/);
                if (!action) {
                    if (!Featured.flag) {
                        Featured.add_message(
                        "<div class='message" + delay_css + "'>" +
                        "<span class='body'>" + body.replace(Constant.cleaner_message,"") + "</span></div>");
                    } else if (!Featured.endsWith(body, Constant.cleaner_message)){
                        Featured.add_message(
                        "<div class='message" + delay_css + "'>" +
                        "<span class='body'>" + body + "</span></div>");
                    };

                } else {
                    Featured.add_message(
                        "<div class='message action " + delay_css + "'>" +
                        "* " + nick + " " + action[1] + "</div>");
                }
            } else {
                Featured.add_message("<div class='notice'>*** " + body +
                    "</div>");
            }
        }

        return true;
    },

    endsWith: function(o,s) {
        return o.length >= s.length && o.substr(o.length - s.length) == s;
    },

    add_message: function(msg) {
        // detect if we are scrolled all the way down
        var chat = $('#chat').get(0);
        var at_bottom = chat.scrollTop >= chat.scrollHeight - chat.clientHeight;

        $('#chat').append(msg);

        // if we were at the bottom, keep us at the bottom
        if (at_bottom) {
            chat.scrollTop = chat.scrollHeight;
        }
    },

    init: function(teacher_name, type, username, password) {
        Featured.flag = false;
        Featured.login_type = type;
        Featured.username = username;
        Featured.password = password;

        if (type == Constant.student_login) {
            $('#input').hide();
            $('#delete').hide();
        } else {
            $('#input').show();
            $('#delete').show();
        };

        $('#room-name').text(teacher_name + '的公告栏');

        Featured.room = teacher_name + Constant.featured + "@conference.localhost";
        Featured.nickname = username;

        $(document).trigger('connect', {
            jid: Featured.nickname + "@localhost",
            password: password
        });
    },

    clear: function () {
        Featured.flag = true;
        var num = parseInt(Constant.featured_message_num);
        for (var i = 0; i < num; i++) {
            Featured.connection.send(
            $msg({
                to: Featured.room,
                type: "groupchat"
            }).c('body').t(Constant.cleaner_message));
        }

        $('#chat div').each(function() {
            $(this).remove();
            return false;
        });

        $('#chat div').each(function() {
            var body = $(this).text();
            Featured.connection.send(
            $msg({
                to: Featured.room,
                type: "groupchat"
            }).c('body').t(body + Constant.cleaner_message));
            console.log(body);
        });
    },
};

$(document).ready(function() {

    $('#input').tabs().find('.ui-tabs-nav').sortable({
        axis: 'x'
    });

    $('#chat-area').tabs().find('.ui-tabs-nav').sortable({
        axis: 'x'
    });

    var search = parseUri(window.location.search);
    Featured.init(search.queryKey[Constant.teacher_name], search.queryKey[Constant.login_type], search.queryKey[Constant.username], search.queryKey[Constant.password]);

    $('#leave').click(function() {
        $('#leave').attr('disabled', 'disabled');
        Featured.connection.send(
        $pres({
            to: Featured.room + "/" + Featured.nickname,
            type: "unavailable"
        }));
        Featured.connection.disconnect();
    });

    $('#delete').click(function() {
        Featured.clear();
    });

    $('#input').keypress(function(ev) {
        if (ev.which === 13) {
            ev.preventDefault();

            var body = $(this).val();

            Featured.connection.send(
            $msg({
                to: Featured.room,
                type: "groupchat"
            }).c('body').t(body));

            $(this).val('');
        }
    });
});

$(document).bind('connect', function(ev, data) {
    Featured.connection = new Strophe.Connection(
        'http://localhost/http-bind');

    Featured.connection.connect(
    data.jid, data.password,

    function(status) {
        if (status === Strophe.Status.CONNECTED) {
            $(document).trigger('connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('disconnected');
        }
    });
});

$(document).bind('connected', function() {
    Featured.joined = false;
    Featured.participants = {};

    Featured.connection.send($pres().c('priority').t('-1'));

    Featured.connection.addHandler(Featured.on_presence,
    null, "presence");
    Featured.connection.addHandler(Featured.on_public_message,
    null, "message", "groupchat");

    var pres = $pres({
        to: Featured.room + "/" + Featured.nickname
    }).c('x', {
        xmlns: Featured.NS_MUC
    }).c('history', {
        maxstanzas: Constant.featured_message_num,
        // since: "2013-05-12T05:15:00Z",
    });
    Featured.connection.send(pres);
});

$(document).bind('disconnected', function() {
    Featured.connection = null;
    $('#room-name').text('公告栏');
    $('#chat').empty();
    if (!Featured.has_login) {
        alert('该教师尚未建立留言板');
        $('#back_btn').trigger('click');
    } else {
        window.parent.Lightview.hide();
    }
    //window.close();
});

$(document).bind('room_joined', function() {
    Featured.joined = true;
    Featured.has_login = true;
    $('#leave').removeAttr('disabled');
    $('#delete').removeAttr('disabled');
});
