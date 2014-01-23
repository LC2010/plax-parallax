(function ($) {
    var maxfps              = 25,
        delay               = 1 / maxfps * 1000,
        lastRender          = new Date().getTime(),
        layers              = [],
        plaxActivityTarget  = $(window),
        motionDegrees       = 30,
        motionMax           = 1,
        motionMin           = -1,
        motionStartX        = null,
        motionStartY        = null,
        ignoreMoveable      = false;

    $.fn.plaxify = function(params) {
        return this.each(function () {
            var layerExistsAt = -1;
            var layer         = {
                'xRange': $(this).data('xrange') || 0,
                'yRange': $(this).data('yrange') || 0,
                'invert': $(this).data('invert') || false,
                'background': $(this).data('background') || false
            };

            for (var i = 0, l = layers.length; i < l; i++) {
                if (this === layers[i].obj.get(0)) {
                    layerExistsAt = i;
                }
            }

            // 如果没有自定义属性值就用参数覆盖layer对象
            for (var param in params) {
                if (layer[param] == 0) {
                    layer[param] = params[param];
                }
            }

            // 方向反转参数
            layer.inversionFactor = (layer.invert ? -1 : 1);
            layer.obj = $(this);

            // 如果是以背景的形式出现
            if (layer.background) {
                var pos = (layer.obj.css('background-position') || '0px 0px').split(/ /);
                if (pos.length != 2) {
                    return;
                }
                // 需要具有left, top属性
                var x = pos[0].match(/^((-?\d+)\s*px|0+\s*%|left)$/);
                var y = pos[1].match(/^((-?\d+)\s*px|0+\s*%|top)$/);
                if (!x || !y) {
                    return;
                }

                layer.originX = layer.startX = x[2] || 0;
                layer.originY = layer.startY = y[2] || 0;
            } else {
                // 获取图层的坐标
                var position = layer.obj.position();
                layer.obj.css({
                    'top'   : position.top,
                    'left'  : position.left,
                    'right' : '',
                    'bottom': ''
                });

                layer.originX = layer.startX = position.left;
                layer.originY = layer.startY = position.top;
            }

            // 根据反转属性和Range值来确认坐标
            layer.startX -= layer.inversionFactor * Math.floor(layer.xRange/2);
            layer.startY -= layer.inversionFactor * Math.floor(layer.yRange/2);
            // 维护唯一的图层数组
            if (layerExistsAt >= 0) {
                layers.splice(layerExistsAt, 1, layer);
            } else {
                layers.push(layer);
            }



            /**
             * 图层的最终数据结构
             *
             *  var layers = [
             *      {
             *          background: false,
             *          inversionFactor: -1,
             *          invert: true,
             *          obj: xx,
             *          startX: -20,
             *          startY: -20,
             *          xRange: 0,
             *          yRange: 20
             *      },
             *      {
             *      }
             *  ]
             *
             */


        });
    };

    // 检测是否具备动力感应(mobile端)
    function moveable() {
        return (ignoreMoveable == true) ? false : window.DeviceOrientationEvent != undefined;
    }

    // 获取陀螺仪的x y
    function valuesFromMotion(e) {
        var x = e.gamma, y = e.beta;

        // Swap x and y in Landscape orientation
        if (Math.abs(window.orientation) === 90) {
            var a = x;
            x = y;
            y = x;
        }

        // 如果倒置
        if (window.orientation < 0) {
            x = -x;
            y = -y;
        }

        motionStartX = (motionStartX == null) ? x : motionStartX;
        motionStartY = (motionStartY == null) ? y : motionStartY;

        return {
            x: x - motionStartX,
            y: y - motionStartY
        };
    }

    // 通过鼠标或者设备的坐标，根据layer的属性来移动layers中的所用层，形成视觉差
    function plaxifier(e) {
        // 响应频率
        if (new Date().getTime() < lastRender + delay) return;
        lastRender = new Date().getTime();

        var leftOffset = (plaxActivityTarget.offset() != null) ? plaxActivityTarget.offset().left : 0,
            topOffset  = (plaxActivityTarget.offset() != null) ? plaxActivityTarget.offset().top : 0,
            // 获取鼠标与容器的坐标差值
            x          = e.pageX - leftOffset,
            y          = e.pageY - topOffset;

        // 鼠标移出监测范围以外
        if (x < 0 || x > plaxActivityTarget.width()
            ||
            y < 0 || y > plaxActivityTarget.height()) return;

        if (moveable()) {
            if (e.gamma === undefined) {
                ignoreMoveable = true;
                return;
            }
            var values = valuesFromMotion(e);

            x = values.x / motionDegrees;
            y = values.y / motionDegrees;

            // 确保范围界限
            x = x < motionMin ? motionMin : (x > motionMax ? motionMax : x);
            y = y < motionMin ? motionMin : (y > motionMax ? motionMax : y);

            x = (x + 1) / 2;
            y = (y + 1) / 2;
        }

        // 获取坐标与舞台的差值比率
        var hRatio = x / ((moveable() == true) ? motionMax : plaxActivityTarget.width()),
            vRatio = y / ((moveable() == true) ? motionMax : plaxActivityTarget.height()),
            layer, i;

        for (i = layers.length; i--; ) {
            layer = layers[i];
            // ** 比率公式
            var newX = layer.startX + layer.inversionFactor * (layer.xRange * hRatio);
            var newY = layer.startY + layer.inversionFactor * (layer.yRange * vRatio);
            if (layer.background) {
                layer.obj.css('background-position', newX + 'px', newY + 'px');
            } else {
                layer.obj
                    .css('left', newX)
                    .css('top', newY);
            }
        }
    }

    // 策略开关
    $.plax = {
        enable: function(opts){
            if (opts) {
                if (opts.activityTarget) plaxActivityTarget = opts.activityTarget || $(window);
                if (typeof opts.gyroRange === 'number' && opts.gyroRange > 0) motionDegrees = opts.gyroRange;
            }

            $(document).bind('mousemove.plax', function (e) {
                plaxifier(e);
            })

            if(moveable()){
                window.ondeviceorientation = function(e){ plaxifier(e); }
            }

        },

        disable: function(opts){
            $(document).unbind('mousemove.plax');
            window.ondeviceorientation = undefined;
            if (opts && typeof opts.restorePositions === 'boolean' && opts.restorePositions) {
                for(var i = layers.length; i--;) {
                    var layer = layers[i];
                    if(layers[i].background) {
                        layer.obj.css('background-position', layer.originX + 'px '+layer.originY + 'px');
                    } else {
                        layer.obj
                          .css('left', layer.originX)
                          .css('top', layer.originY);
                        }
                }
          }
          if (opts && typeof opts.clearLayers === 'boolean' && opts.clearLayers) layers = [];
        }
  }
})(jQuery);