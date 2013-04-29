var Online = {
    connection: null,
    online_users: null,

    on_online_users: function (iq) {
        console.log(iq);
        var online_users = {};
        $(iq).find('item').each(function () {
            var name = Strophe.getNodeFromJid($(this).attr('name'));
            online_users[name] = true;
        });

        Online.online_users = online_users;
        Groupie.listRooms();
        return false;
    }

};

$(document).bind('student_connect', function (ev, data) {
    console.log("Groupie room : " + Groupie.room);
    if (Groupie.room != null) {
        return;
    }
    var conn = new Strophe.Connection(
        'http://localhost/http-bind');

    conn.connect("admin@localhost", "admin", function (status) {
        if (status === Strophe.Status.CONNECTED) {
                $(document).trigger('student_connected');            
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('disconnected');
        }
    });

    Online.connection = conn;
});

$(document).bind('student_connected', function () {
    //get onine users

    Online.connection.addHandler(Online.on_online_users,
                                  null, "iq");
    var iq = $iq({to: "localhost",
                             type: "get"})
                            .c('query', {xmlns: "http://jabber.org/protocol/disco#items", node: "online users"});
    Online.connection.sendIQ(iq);
});

$(document).bind('student_disconnected', function () {
    Online.connection = null;
});
