var Groupie = {
    connection: null,
    room: null,
    nickname: null,
    register_password: null,

    NS_MUC: "http://jabber.org/protocol/muc",

    joined: null,
    participants: null,
    position: null,//学生的位置
    total: null,//教师加所有学生的总人数
    teacher_nickname: null,//正在答疑教师的昵称
    student_nickname: null,//正在提问学生的昵称
    has_login : false,
    
    user_password: null,

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
                
                //每出现一个人就总人数就加1
                total++;                
                
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
        
        //如果是老师，则记录学生的昵称
        if (Groupie.nickname == Groupie.teacher_nickname) {
            Groupie.student_nickname = nick;
        }
        
        console.log('message : ' + message);

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

    //更新学生的位置
    on_position_change: function () {
        //teacher in the first place
        if (Groupie.nickname != Groupie.teacher_nickname){
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

    //列出所有可用房间列表
    listRooms: function () {
        console.log(Online.online_users);

        var iq = $iq({to: "conference.localhost",
                      //from: "admin@localhost",//Groupie.participants[Groupie.nickname],
                      type: "get"})
            .c("query",{xmlns: Strophe.NS.DISCO_ITEMS}); 
        Groupie.connection.sendIQ(iq, Groupie.show_rooms, Groupie.error_cb);        
    },

    error_cb: function (iq) {
        console.log("list_rooms error : " + iq);
    },

    show_rooms: function (iq) {
        //计数可用房间数量
        var count = 0;
        $('item', iq).each(function (index, value) {
            count++;
            var name = $(value).attr('name');
            var jid = $(value).attr('jid');
            
            if (typeof name == 'undefined') {
                name = jid.split('@')[0];
            } //if

            var color = "blue";
            if (Online.online_users[Strophe.getNodeFromJid(jid)]) { color = "red"};
            var element = $("<button id=" + jid + "><font color=" + color + ">" + Strophe.getNodeFromJid(jid) + "</font></button></br>");
            $("#room_panel").append(element);
        });

        //初始化房间列表对话框
        if (count == 0) {
            Groupie.connection.disconnect();
            alert("目前没有老师答疑");
            Groupie.has_login = true;
        }else {
            var ul = document.getElementById('room_panel');
            var lis = ul.getElementsByTagName('button');
                for(var i=0;i<lis.length;i++){
                    lis[i].onclick = function(){
                        var name = Strophe.getNodeFromJid(this.id);
                        Groupie.teacher_nickname = name;
                        if (Online.online_users[name]) {
                            Groupie.room = this.id;
                            Groupie.teacher_nickname = name;
                            $(document).trigger('connected');
                            $("#rooms_dialog").dialog('close');
                            $("#room_panel").empty(); 
                        } else{
                            document.getElementById('teacher_name').innerHTML = Groupie.teacher_nickname + ' ';
                            $('#chat_dialog').dialog('open');
                        };
                   }
                } 
            $("#rooms_dialog").dialog('open');
        };
    },

    //发送消息body给对方to
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
    },
    
    login: function () {
        Groupie.has_login = false;
        Groupie.nickname = $('#jid').val().toLowerCase();
        Groupie.user_password = $('#password').val();
        
        $(document).trigger('connect', {
                    jid: Groupie.nickname + "@localhost",
                    password: Groupie.user_password
        });
        Groupie.on_offline_msg(false);

        $('#password').val('');
        $('#login_dialog').dialog('close');
    },

    on_register: function (status) {
        console.log(status);
        if (status === Strophe.Status.REGISTER) {
            Groupie.connection.register.fields.username = Groupie.nickname;
            Groupie.connection.register.fields.password = Groupie.register_password;
            Groupie.connection.register.submit();
        } else if (status === Strophe.Status.REGISTERED) {
            console.log("registered!");
            Groupie.login();
            //Groupie.connection.authenticate();
            //$('#login_dialog').dialog('open');
        } else if (status === Strophe.Status.SBMTFAIL) {
            console.log("submit failed");
            alert('注册失败，请尝试使用其他用户名');
            $('#password').val('');
            $(document).trigger('disconnected');
        } else {
            // every other status a connection.connect would receive
        }
    },

    on_offline_msg: function (need_receive_msg) {
        Gab.need_receive_msg = need_receive_msg;
        $(document).trigger('offline_connect', {
                    jid: Groupie.nickname + "@localhost",
                    password: Groupie.user_password
        });
    }

};

$(document).ready(function () {
    $('#login_dialog').dialog({
        autoOpen: true,
        draggable: false,
        modal: true,
        title: '登陆',
        width: 350,
        buttons: {
            "教师登陆": function () {
                Groupie.room = $('#jid').val().toLowerCase() + "@conference.localhost";
                Groupie.teacher_nickname = $('#jid').val().toLowerCase();
                Groupie.login();
            },

            "学生登陆": function () {
                Groupie.room = null;
                Groupie.teacher_nickname = null;
                Groupie.login();
            },

            "学生注册": function () {
                Groupie.room = null;
                Groupie.teacher_nickname = null;
                var username = $('#jid').val().toLowerCase();
                if( username.length > 0 ){
                    Groupie.nickname = username;
                    Groupie.register_password = $('#password').val();
                    Groupie.connection = new Strophe.Connection('http://localhost/http-bind');
                    Groupie.connection.register.connect("localhost", Groupie.on_register);
                    $(this).dialog('close');
                }else {
                    alert('请输入用户名和密码');
                }
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
        Groupie.has_login = true;
        Groupie.connection.disconnect();
        if (Gab.connection != null) {
            Gab.connection.disconnect();
        };
        if (Online.connection != null) {
            Online.connection.disconnect();            
        };


    });

    $('#offline_msg').click(function () {
        $('#offline_msg').attr('disabled', 'disabled');
        Groupie.on_offline_msg(true);       
    });

    $('#input').keypress(function (ev) {
        if (ev.which === 13) {
            ev.preventDefault();
            
            //正在排队的学生暂时不能提问
            if (position > 2) {
                alert('对不起，你现在还不能提问，请耐心等待。');
                return;
            };

            var body = $(this).val();

            var match = body.match(/^\/(.*?)(?: (.*))?$/);
            var args = null;
            if (match) {
                if (match[1] === "msg") {
                    args = match[2].match(/^(.*?) (.*)$/);
                    if (Groupie.participants[args[1]]) {
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
                //如果是老师，则将消息发送给学生，否则发送消息给老师
                var target = Groupie.teacher_nickname;
                if (Groupie.nickname == Groupie.teacher_nickname) {
                    target = Groupie.student_nickname;
                };
                Groupie.send_msg(target, body);
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
                //如果是学生登陆，则列出可用房间列表
                if (Groupie.room == null) {
                    $(document).trigger('student_connect');                    
                } else{
                    $(document).trigger('connected');                    
                };
            } else if (status === Strophe.Status.DISCONNECTED) {
                console.log('Groupie disconnected');
                if (!Groupie.has_login) {
                    alert('你好像不是教师，请使用学生登陆。');                    
                };
                $(document).trigger('disconnected');
            } else if (status === Strophe.Status.AUTHFAIL) {
                alert('请使用正确的用户名和密码登陆。');
                $(document).trigger('disconnected');
            }
        });
});

$(document).bind('connected', function () {
    Groupie.joined = false;
    Groupie.participants = {};
    //初始化人员总数和位置为0
    total = 0;
    position = 0;

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
    //如果是当前用户就记录该用户的位置
    position = total;
    
    Groupie.joined = true;
    Groupie.has_login = true;

    $('#leave').removeAttr('disabled');
    $('#offline_msg').removeAttr('disabled');
    $('#room-name').text("教师答疑" + Groupie.teacher_nickname);

    Groupie.add_message("<div class='notice'>你好，欢迎来到教师答疑系统.</div>");
    Groupie.on_position_change();
});

$(document).bind('user_joined', function (ev, nick) {
    Groupie.add_message("<div class='notice'>*** " + nick +
                         " 已加入排队.</div>");
});

$(document).bind('user_left', function (ev, nick) {
    Groupie.add_message("<div class='notice'>*** " + nick +
                        " 离开了.</div>");
    //如果是老师退出，则所有学生都退出
    if (nick == Groupie.teacher_nickname) {
        $('#leave').trigger('click');
        return;
    };
    
    //如果是学生退出，则更新所有学生的位置，排在该学生之前的学生位置不变，之后的每人向前一位
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
    
    //删除已退出的学生
    delete Groupie.participants[nick];
    //总人数减1
    total--;

});
