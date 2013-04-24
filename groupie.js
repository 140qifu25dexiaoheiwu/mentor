var Groupie = {
    connection: null,
    room: null,
    nickname: null,

    NS_MUC: "http://jabber.org/protocol/muc",

    joined: null,
    participants: null,
    position: null,
    total: null,
    teacher_nickname: null,
    student_nickname: null,

    on_presence: function (presence) {
        var from = $(presence).attr('from');
        var room = Strophe.getBareJidFromJid(from);

        // make sure this presence is for the right room
        if (room === Groupie.room) {
            var nick = Strophe.getResourceFromJid(from);
          
            if ($(presence).attr('type') === 'error' &&
                !Groupie.joined) {
                // error joining room; reset app
                Groupie.connection.disconnect();
            } else if (!Groupie.participants[nick] &&
                $(presence).attr('type') !== 'unavailable') {
                // add to participant list
                var user_jid = $(presence).find('item').attr('jid');
                Groupie.participants[nick] = user_jid || true;

                $('#participant-list').append('<li>' + nick + '</li>');
                total++;
                console.log(total);
                if (Groupie.joined) {
                    $(document).trigger('user_joined', nick);
                }
            } else if (Groupie.participants[nick] &&
                       $(presence).attr('type') === 'unavailable') {
                // remove from participants list
                $('#participant-list li').each(function () {
                    if (nick === $(this).text()) {
                        $(this).remove();
                        return false;
                    }
                });

                $(document).trigger('user_left', nick);
            }

            if ($(presence).attr('type') !== 'error' && 
                !Groupie.joined) {
                // check for status 110 to see if it's our own presence
                if ($(presence).find("status[code='110']").length > 0) {
                    // check if server changed our nick
                    if ($(presence).find("status[code='210']").length > 0) {
                        Groupie.nickname = Strophe.getResourceFromJid(from);
                    }

                    position = total;
                    // room join complete
                    $(document).trigger("room_joined");
                }
            }
        }

        return true;
    },

    on_public_message: function (message) {
        var from = $(message).attr('from');
        var room = Strophe.getBareJidFromJid(from);
        var nick = Strophe.getResourceFromJid(from);

        // make sure message is from the right place
        if (room === Groupie.room) {
            // is message from a user or the room itself?
            var notice = !nick;

            // messages from ourself will be styled differently
            var nick_class = "nick";
            if (nick === Groupie.nickname) {
                nick_class += " self";
            }
            
            var body = $(message).children('body').text();

            var delayed = $(message).children("delay").length > 0  ||
                $(message).children("x[xmlns='jabber:x:delay']").length > 0;

            // look for room topic change
            var subject = $(message).children('subject').text();
            if (subject) {
                $('#room-topic').text(subject);
            }

            if (!notice) {
                var delay_css = delayed ? " delayed" : "";

                var action = body.match(/\/me (.*)$/);
                if (!action) {
                    Groupie.add_message(
                        "<div class='message" + delay_css + "'>" +
                            "&lt;<span class='" + nick_class + "'>" +
                            nick + "</span>&gt; <span class='body'>" +
                            body + "</span></div>");
                } else {
                    Groupie.add_message(
                        "<div class='message action " + delay_css + "'>" +
                            "* " + nick + " " + action[1] + "</div>");
                }
            } else {
                Groupie.add_message("<div class='notice'>*** " + body +
                                    "</div>");
            }
        }

        return true;
    },

    add_message: function (msg) {
        // detect if we are scrolled all the way down
        var chat = $('#chat').get(0);
        var at_bottom = chat.scrollTop >= chat.scrollHeight - 
            chat.clientHeight;
        
        $('#chat').append(msg);

        // if we were at the bottom, keep us at the bottom
        if (at_bottom) {
            chat.scrollTop = chat.scrollHeight;
        }
    },

    on_private_message: function (message) {
        var from = $(message).attr('from');
        var room = Strophe.getBareJidFromJid(from);
        var nick = Strophe.getResourceFromJid(from);
        Groupie.student_nickname = nick;
        console.log("private message");
        // make sure this message is from the correct room
        if (room === Groupie.room) {
            var body = $(message).children('body').text();
            Groupie.add_message("<div class='message private'>" +
                                "&lt;<span class='nick'>" +
                                nick + "</span>&gt; <span class='body'>" +
                                body + "</span></div>");
            
        }

        return true;
    },

    on_position_change: function () {
        //teacher in the first place
        if (position != 1){
          if (position == 2) {
            Groupie.add_message("<div class='notice'>同学，你正处于第1位，可以开始提问 </div>");
            Groupie.connection.send(
                                $msg({
                                    to: Groupie.room + "/" + Groupie.teacher_nickname,
                                    type: "chat"}).c('body').t("老师好，我是" + Groupie.nickname));
          } else{
            Groupie.add_message("<div class='notice'>同学，你正处于第"+ (position-1) + "位，请耐心等待</div>");
          };  
        }
    },

    listRooms: function () {
        var iq = $iq({to: "conference.localhost",
                      //from: "admin@localhost",//Groupie.participants[Groupie.nickname],
                      type: "get"})
            .c("query",{xmlns: Strophe.NS.DISCO_ITEMS}); 
        Groupie.connection.sendIQ(iq, Groupie.showRoom, Groupie.error_cb, 600);        
    },

    error_cb: function (iq) {
        console.log(iq);
    },

    showRoom: function (iq) {
        console.log(iq);
        var count = 0;
        $('item', iq).each(function (index, value) {
            count++;
            var name = $(value).attr('name');
            var jid = $(value).attr('jid');
            
            if (typeof name == 'undefined') {
                name = jid.split('@')[0];
            } //if

            var element = $("<button id=" + jid + ">" + Strophe.getNodeFromJid(jid) + "</button>");
            $("#room_panel").append(element);
        });

        if (count == 0) {
            Groupie.connection.disconnect();
            alert("啊哦，目前没有老师答疑");
        }else {
            var ul = document.getElementById('room_panel');
            var lis = ul.getElementsByTagName('button');
                for(var i=0;i<lis.length;i++){
                    lis[i].onclick = function(){
                    Groupie.room = this.id;
                    Groupie.teacher_nickname = Strophe.getNodeFromJid(Groupie.room);
                    $(document).trigger('connected');
                    $("#rooms_dialog").dialog('close');
                    $("#room_panel").empty();                 
                   }
                } 
            $("#rooms_dialog").dialog('open');
        };
    },

    send_msg: function (to, body) {
        console.log("room : " + Groupie.room);
        console.log("send msg to : " + to);
        console.log("msg body : " + body);
        Groupie.connection.send(
                            $msg({
                                to: Groupie.room + "/" + to,
                                type: "chat"}).c('body').t(body));
                        Groupie.add_message(
                            "<div class='message private'>" +
                                " &lt;<span class='nick self'>" +
                                Groupie.nickname + 
                                "</span>&gt; <span class='body'>" +
                                body + "</span> </div>");
    }
};

$(document).ready(function () {
    $('#login_dialog').dialog({
        autoOpen: true,
        draggable: false,
        modal: true,
        title: 'Join a Room',
        buttons: {
            "教师登陆": function () {
                //Groupie.room = $('#room').val().toLowerCase();
                //Groupie.nickname = $('#nickname').val();
                Groupie.room = $('#jid').val().toLowerCase() + "@conference.localhost";
                Groupie.nickname = $('#jid').val().toLowerCase();
                //get teacher's nickname
                Groupie.teacher_nickname = Groupie.nickname;

                $(document).trigger('connect', {
                    jid: $('#jid').val().toLowerCase() + "@localhost",
                    password: $('#password').val()
                });

                $('#password').val('');
                $(this).dialog('close');
            },

            "学生登陆": function () {
                Groupie.nickname = $('#jid').val().toLowerCase();
                Groupie.room = null;
                $(document).trigger('connect', {
                    jid: $('#jid').val().toLowerCase() + "@localhost",
                    password: $('#password').val()
                });
                $('#password').val('');
                $(this).dialog('close');
            }
        }
    });

    $('#rooms_dialog').dialog({
        autoOpen: false,
        draggable: false,
        modal: true,
        title: '在线教师列表',
    });

    $('#leave').click(function () {
        $('#leave').attr('disabled', 'disabled');
        Groupie.connection.send(
            $pres({to: Groupie.room + "/" + Groupie.nickname,
                   type: "unavailable"}));
        Groupie.connection.disconnect();
    });

    $('#input').keypress(function (ev) {
        if (ev.which === 13) {
            ev.preventDefault();
            //only teacher and first student can chat.
            if (position != 1 && position != 2) {
                alert('sorry, you might not ask question right now, please waiting for your turn.');
                return;
            };

            var body = $(this).val();

            var match = body.match(/^\/(.*?)(?: (.*))?$/);
            var args = null;
            if (match) {
                if (match[1] === "msg") {
                    args = match[2].match(/^(.*?) (.*)$/);
                    if (Groupie.participants[args[1]]) {
                        console.log(args[1]);
                        //todo
                        Groupie.connection.send(
                            $msg({
                                to: Groupie.room + "/" + args[1],
                                type: "chat"}).c('body').t(body));
                        Groupie.add_message(
                            "<div class='message private'>" +
                                "@@ &lt;<span class='nick self'>" +
                                Groupie.nickname + 
                                "</span>&gt; <span class='body'>" +
                                args[2] + "</span> @@</div>");
                    } else {
                        Groupie.add_message(
                            "<div class='notice error'>" +
                                "Error: User not in room." +
                                "</div>");
                    }
                } else if (match[1] === "me" || match[1] === "action") {
                    Groupie.connection.send(
                        $msg({
                            to: Groupie.room,
                            type: "groupchat"}).c('body')
                            .t('/me ' + match[2]));
                } else if (match[1] === "topic") {
                    Groupie.connection.send(
                        $msg({to: Groupie.room,
                              type: "groupchat"}).c('subject')
                            .text(match[2]));
                } else if (match[1] === "kick") {
                    Groupie.connection.sendIQ(
                        $iq({to: Groupie.room,
                             type: "set"})
                            .c('query', {xmlns: Groupie.NS_MUC + "#admin"})
                            .c('item', {nick: match[2],
                                        role: "none"}));
                } else if (match[1] === "ban") {
                    Groupie.connection.sendIQ(
                        $iq({to: Groupie.room,
                             type: "set"})
                            .c('query', {xmlns: Groupie.NS_MUC + "#admin"})
                            .c('item', {jid: Groupie.participants[match[2]],
                                        affiliation: "outcast"}));
                } else if (match[1] === "op") {
                    Groupie.connection.sendIQ(
                        $iq({to: Groupie.room,
                             type: "set"})
                            .c('query', {xmlns: Groupie.NS_MUC + "#admin"})
                            .c('item', {jid: Groupie.participants[match[2]],
                                        affiliation: "admin"}));
                } else if (match[1] === "deop") {
                    Groupie.connection.sendIQ(
                        $iq({to: Groupie.room,
                             type: "set"})
                            .c('query', {xmlns: Groupie.NS_MUC + "#admin"})
                            .c('item', {jid: Groupie.participants[match[2]],
                                        affiliation: "none"}));
                } else {
                    Groupie.add_message(
                        "<div class='notice error'>" +
                            "Error: Command not recognized." +
                            "</div>");
                }
            } else {
                var target = Groupie.teacher_nickname;
                if (Groupie.nickname == Groupie.teacher_nickname) {
                    target = Groupie.student_nickname;
                };
                console.log(target);
                Groupie.send_msg(target, body);
                /**
                Groupie.connection.send(
                                $msg({
                                    to: Groupie.room + "/" + target,
                                    type: "chat"}).c('body').t(body));
                Groupie.add_message(
                            "<div class='message private'>" +
                                "&lt;<span class='nick self'>" +
                                Groupie.nickname + 
                                "</span>&gt; <span class='body'>" +
                                body + "</span></div>");
                Groupie.connection.send(
                    $msg({
                        to: Groupie.room,
                        type: "groupchat"}).c('body').t(body));
                    */
            }

            $(this).val('');
        }
    });
});

$(document).bind('connect', function (ev, data) {
    Groupie.connection = new Strophe.Connection(
        'http://localhost/http-bind');

    Groupie.connection.connect(
        data.jid, data.password,
        function (status) {
            if (status === Strophe.Status.CONNECTED) {
                console.log(Groupie.room);
                if (Groupie.room == null) {
                    Groupie.listRooms();
                } else{
                    $(document).trigger('connected');                    
                };
            } else if (status === Strophe.Status.DISCONNECTED) {
                $(document).trigger('disconnected');
            }
        });
});

$(document).bind('connected', function () {
    Groupie.joined = false;
    Groupie.participants = {};
    position = 0;
    total = 0;

    Groupie.connection.send($pres().c('priority').t('-1'));
    
    Groupie.connection.addHandler(Groupie.on_presence,
                                  null, "presence");
    Groupie.connection.addHandler(Groupie.on_public_message,
                                  null, "message", "groupchat");
    Groupie.connection.addHandler(Groupie.on_private_message,
                                  null, "message", "chat");

    Groupie.connection.send(
        $pres({
            to: Groupie.room + "/" + Groupie.nickname
        }).c('x', {xmlns: Groupie.NS_MUC}));
});

$(document).bind('disconnected', function () {
    Groupie.connection = null;
    $('#room-name').empty();
    $('#room-topic').empty();
    $('#participant-list').empty();
    $('#chat').empty();
    $('#login_dialog').dialog('open');
});

$(document).bind('room_joined', function () {
    Groupie.joined = true;

    $('#leave').removeAttr('disabled');
    $('#room-name').text(Groupie.room);

    Groupie.add_message("<div class='notice'>*** Room joined.</div>");
    Groupie.on_position_change();
});

$(document).bind('user_joined', function (ev, nick) {
    Groupie.add_message("<div class='notice'>*** " + nick +
                         " joined.</div>");
});

$(document).bind('user_left', function (ev, nick) {
    Groupie.add_message("<div class='notice'>*** " + nick +
                        " left.</div>");

    if (nick == Groupie.teacher_nickname) {
        $('#leave').trigger('click');
        return;
    };
    console.log("old position " + position);
    var before = true;
    for (var item in Groupie.participants ){
        if (item == nick){
            before = false;
            continue;
        }
        if (Groupie.nickname == item) {
            if (!before) {
                position--;
            };
            break;
        };
    }
    console.log("new position " + position);
    Groupie.on_position_change();

    delete Groupie.participants[nick];
    total--;

});
