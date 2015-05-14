// lib_data.js

var prep_data = function(plot_info, nodes) {

  var g       = plot_info.global
      g.nodes = nodes;

  /*
    The input data file, flare-imports.json, is firmly rooted in the
    problem domain.  It uses a list of hashes (aka objects) to define
    a directed graph.  Each hash defines a software module, giving its
    name, size, and a list of names for modules it imports.

    g.nodes = [
      { "name":     "flare.analytics.cluster.AgglomerativeCluster",
        "size":     3938,
        "imports":  [ "flare.animate.Transitioner", ... ]
      }, ...
    ];
  */

  var check_nodes = function(nodes) {
    var defined = {};

    for (var i=0; i<nodes.length; i++) {
      var node_name  = nodes[i].name;
      if (!defined[node_name]) defined[node_name] = true;
    }

    for (var i=0; i<nodes.length; i++) {
      var node_name  = nodes[i].name;
      var imports    = nodes[i].imports;
      for (var j=0; j<imports.length; j++) {
        var imp_name = imports[j];
        if (!defined[imp_name]) {
          var msg = 'Error: Target node (' + imp_name +
                    ') not found for source node (' + node_name + ').';
          console.log (msg);
  } } } };

  check_nodes(nodes);


  /*  Construct nodesByName, an index by node name:

    g.nodesByName = {
      "flare.animate.Pause": {
         "connectors":    [ <links object>, ... ],
         "imports":       [ "flare.animate.Transition", ... ],
         "index":         17,
         "name":          "flare.animate.Pause",
         "packageName":   "animate",
         "size":          449,
         "source":        <links object>,
         "target":        <links object>,
         "type":          "target-source"
      }, ... };
  */

  var index_by_node_name = function(d) {
    d.connectors          = [];
    d.packageName         = d.name.split('.')[1];
    g.nodesByName[d.name] = d;
  };

  g.nodesByName   = {};
  g.nodes.forEach(index_by_node_name);

  /*  Convert the import lists into links with sources and targets.
      Save index hashes for looking up sources and targets.

    g.links = [
      {
        "source":  {
          "degree":   0,
          "node":     <nodesByName object>,
          "type":     "source"
        },

        "target":  {
          "degree":   0,
          "node":     <nodesByName object>,
          "type":     "source-target"
      }, ... ];

    g.sources = {
      <target name>:  <source name>, ...
    }

    g.targets = {
      <source name>:  <target name>, ...
    }
  */

  var do_source = function(source) {

    var do_target = function(targetName) {
      var target = g.nodesByName[targetName];

      if (!source.source) {
        source.source = { node: source,  degree: 0 };
        source.connectors.push(source.source);
      }

      if (!target.target) {
        target.target = { node: target,  degree: 0 };
        target.connectors.push(target.target);
      }

      g.links.push( { source: source.source,  target: target.target } );

      if ( !g.sources[targetName]  ) g.sources[targetName]  = {};
      g.sources[targetName][source.name]  = true;

      if ( !g.targets[source.name] ) g.targets[source.name] = {};
      g.targets[source.name][targetName]  = true;
    }

    source.imports.forEach(do_target);
  };

  g.links     = [];
  g.sources   = {};
  g.targets   = {};
  nodes.forEach(do_source);

  // Determine the type of each node, based on incoming and outgoing links.

  var node_type = function(node) {
    if (node.source && node.target) {
      node.type         = node.source.type = 'target-source';
      node.target.type  = 'source-target';
    } else if (node.source) {
      node.type         = node.source.type = 'source';
    } else if (node.target) {
      node.type         = node.target.type = 'target';
    } else {
      node.connectors   = [{ node: node }];
      node.type         = 'source';
    }
  };

  nodes.forEach(node_type);

  /* Nest nodes by type, for computing the rank.

     Normally, Hive Plots sort nodes by degree along each axis.
     However, since this example visualizes a package hierarchy,
     we get more interesting results if we group nodes by package.

     We don't need to sort explicitly because the data file is
     already sorted by class name.

    g.nodesByType = [
      {
         "count":         80, 
         "key":           "source",
         "values":        [ <nodesByName object>, ... ]
      }, ... ]
  */

  g.nodesByType = d3.nest()
    .key(function(d) { return d.type; })
    .sortKeys(d3.ascending)
    .entries(nodes);

  // Duplicate the target-source axis as source-target.

  g.nodesByType.push({ key:     'source-target',
                       values:  g.nodesByType[2].values });

  // Compute the rank for each type, with padding between packages.

  var type_rank = function(type) {

    var count     = 0,
        lastName  = type.values[0].packageName;

    var node_rank = function(d, i) {
      if (d.packageName != lastName) {
        lastName  = d.packageName;
        count    += 2;
      }
      d.index   = count++;
    };

    type.values.forEach(node_rank);
    type.count  = count - 1;
  };

  g.nodesByType.forEach(type_rank);

  // Console logging calls.
  
  if (false) {
    console.log('g.links',          g.links); //T
    console.log('g.nodes',          g.nodes); //T
    console.log('g.nodesByType',    g.nodesByType); //T
    console.log('g.nodesByName',    g.nodesByName); //T
    console.log('g.sources',        g.sources); //T
  }

};
// lib_link.js
//
// A shape generator for Hive links, based on a source and a target.
// The source and target are defined in polar coordinates (angle and radius).
// Ratio links can also be drawn by using a startRadius and endRadius.
// This class is modeled after d3.svg.chord.

function make_link() {

  var source      = function(d) { return d.source; },
      target      = function(d) { return d.target; },
      angle       = function(d) { return d.angle;  },
      startRadius = function(d) { return d.radius; },
      endRadius   = startRadius,
      arcOffset   = -Math.PI / 2;


  function link(d, i) {

    var s   = node(source, this, d, i),
        t   = node(target, this, d, i),
        x;

    d.ib_edge = t.a < s.a;

    if (d.ib_edge) x = t, t = s, s = x;

    if (t.a - s.a > Math.PI) s.a += 2 * Math.PI;

    var a1      = s.a + (t.a - s.a) / 3,
        a2      = t.a - (t.a - s.a) / 3,
        cos_a1  = Math.cos(a1),     sin_a1  = Math.sin(a1),
        cos_a2  = Math.cos(a2),     sin_a2  = Math.sin(a2),
        cos_sa  = Math.cos(s.a),    sin_sa  = Math.sin(s.a),
        cos_ta  = Math.cos(t.a),    sin_ta  = Math.sin(t.a);

    if (s.r0 - s.r1 || t.r0 - t.r1) {
      return  'M' + cos_sa * s.r0 + ',' + sin_sa * s.r0 +
              'L' + cos_sa * s.r1 + ',' + sin_sa * s.r1 +
              'C' + cos_a1 * s.r1 + ',' + sin_a1 * s.r1 +
              ' ' + cos_a2 * t.r1 + ',' + sin_a2 * t.r1 +
              ' ' + cos_ta * t.r1 + ',' + sin_ta * t.r1 +
              'L' + cos_ta * t.r0 + ',' + sin_ta * t.r0 +
              'C' + cos_a2 * t.r0 + ',' + sin_a2 * t.r0 +
              ' ' + cos_a1 * s.r0 + ',' + sin_a1 * s.r0 +
              ' ' + cos_sa * s.r0 + ',' + sin_sa * s.r0;
    } else {
      return  'M' + cos_sa * s.r0 + ',' + sin_sa * s.r0 +
              'C' + cos_a1 * s.r1 + ',' + sin_a1 * s.r1 +
              ' ' + cos_a2 * t.r1 + ',' + sin_a2 * t.r1 +
              ' ' + cos_ta * t.r1 + ',' + sin_ta * t.r1;
    }
  }


  function node(method, thiz, d, i) {

    var node  = method.call(thiz, d, i),
        a     = +(typeof angle       === 'function'
                    ? angle.call(thiz, node, i)
                    : angle) + arcOffset,
        r0    = +(typeof startRadius === 'function'
                    ? startRadius.call(thiz, node, i)
                    : startRadius),
        r1t   = +(typeof endRadius   === 'function'
                    ? endRadius.call(thiz, node, i)
                    : endRadius),
        r1    = startRadius === endRadius ? r0 : r1t;

    return { r0: r0, r1: r1, a: a };
  }


  function make_func(object, method) {

    eval(object + '.' + method + "= function(_) {\n" +
         '  if (!arguments.length) return ' + method + ";\n" +
         '    ' + method + "= _;\n" +
         '    return ' + object + ";\n};\n" );
  }

  make_func('link', 'source');
  make_func('link', 'target');
  make_func('link', 'angle');
  make_func('link', 'startRadius');
  make_func('link', 'endRadius');

  link.radius = function(_) {
    if (!arguments.length) return startRadius;
    startRadius = endRadius = _;
    return link;
  };

  return link;
}
// lib_mouse.js

var setup_mouse = function(plot_info) {

  var g = plot_info.global;

  // Initialize the info display.

  var default_precis,
      formatNumber  = d3.format(',d'),
      indent        = '&nbsp;&nbsp;';

  var notes   = d3.select(g.selector + ' .notes')

  var precis  = d3.select(g.selector + ' .precis')
    .text(default_precis = 'Showing ' + formatNumber(g.links.length)
             + ' dependencies among ' + formatNumber(g.nodes.length)
             + ' classes.');


  on_mouseout = function() {
  //
  // Clear any highlighted nodes or links.

    g.svg.selectAll('.active_ib').classed('active_ib', false);
    g.svg.selectAll('.active_im').classed('active_im', false);
    g.svg.selectAll('.active_mo').classed('active_mo', false);

    notes.html('');
    precis.text(default_precis);
  }


  on_mouseover_h = function(css_class, html_inp) {
  //
  // Helper for on_mouseover_{link,node}.

    if (!html_inp) return '';

    if (css_class == 'ib')
      hdr  = '<h4 class="ib">User Follows:</h4>';
    else
      hdr  = '<h4 class="im">Followers:</h4>';

    return '<span class="' + css_class+ '">'
         + hdr + html_inp + '</span>';
  };


  on_mouseover_link = function(orig_link) {
  //
  // Highlight the link and connected nodes on mouseover.
  //
  // Mousing over a link should cause:
  //
  //   the link to turn red
  //   the nodes that it imports to turn green
  //   the nodes that import it  to turn blue
  //   the sidebar to show consistent colors and text

    var trace     = false;

    var link_mo   = function(curr_link) {
      var result  = curr_link === orig_link;

//    if (result) console.log('link_mo', curr_link, orig_link); //T
      return result;
    };

    var node_ib  = function(curr_node) {
      var curr_name   = curr_node.node.name;
      var orig_name   = orig_link.source.node.name;

      var result      = curr_name === orig_name;

      if (trace && result) console.log('node_ib',
        curr_name, curr_node, orig_name, orig_link); //T
      return result;
    };

    var node_im  = function(curr_node) {
      var curr_name   = curr_node.node.name;
      var orig_name   = orig_link.target.node.name;

      var result      = curr_name === orig_name;

      if (trace && result) console.log('node_im',
       curr_name, curr_node, orig_name, orig_link); //T
      return result;
    };

    g.svg.selectAll('.link'        ).classed('active_mo', link_mo);

    g.svg.selectAll('.node ellipse').classed('active_ib', node_ib);
    g.svg.selectAll('.node ellipse').classed('active_im', node_im);

    var src_name  = orig_link.source.node.name;
    var tgt_name  = orig_link.target.node.name;

    var html_ib   = on_mouseover_h('ib', src_name);
    var html_im   = on_mouseover_h('im', tgt_name);
    var html      = '<h3 class="mo">Edge</h3>'
                  + html_ib + html_im;

    notes.html(html);

    precis.text(src_name + ' -> ' + tgt_name);
  }


  on_mouseover_node = function(orig_node) {
  //
  // Highlight the node and connected links on mouseover.
  //
  // Mousing over a node should cause:
  //
  //   the node (and its clone, if any)    to turn red
  //   the links and nodes that it imports to turn green
  //   the links and nodes that import it  to turn blue
  //   the sidebar to show consistent colors and text

    var trace     = false;

    var link_ib  = function(curr_link) {
      var curr_name   = curr_link.target.node.name;
      var orig_name   = orig_node.node.name;

      var result = curr_name === orig_name;
      if (trace && result) console.log('link_ib',
        curr_name, curr_link, orig_name, orig_node); //T
      return result;
    };

    var link_im  = function(curr_link) {
      var curr_name   = curr_link.source.node.name;
      var orig_name   = orig_node.node.name;

      var result = curr_name === orig_name;
      if (trace && result) console.log('link_im',
        curr_link, orig_node); //T
      return result;
   };

    var node_ib  = function(curr_node) {
      var curr_name   = curr_node.node.name;
      var orig_name   = orig_node.node.name;
      var curr_tgts   = g.targets[curr_name];
      var result      = false;

      if (curr_tgts) {
        for (curr_tgt in curr_tgts)
          if (curr_tgt === orig_name) result = 'target';
      }

      if (trace && result) console.log('node_ib',
        curr_name, curr_node, orig_name, orig_node, curr_tgts, result); //T
      return result;
    };

    var node_im  = function(curr_node) {
      var curr_name   = curr_node.node.name;
      var orig_name   = orig_node.node.name;
      var curr_srcs   = g.sources[curr_name];
      var result      = false;

      if (curr_srcs) {
        for (curr_src in curr_srcs)
          if (curr_src === orig_name) result = 'source';
      }

      if (trace && result) console.log('node_im',
        curr_name, curr_node, orig_name, orig_node, curr_srcs, result); //T
      return result;
    };

    var node_mo = function(curr_node) {
      var curr_name   = curr_node.node.name;
      var orig_name   = orig_node.node.name;
      var result      = false;

      if (curr_name === orig_name) result = 'same or clone';

      if (trace && result) console.log('node_mo',
        curr_name, curr_node, orig_name, orig_node, result); //T
      return result;
    };

    g.svg.selectAll('.link'         ).classed('active_ib', link_ib);
    g.svg.selectAll('.link'         ).classed('active_im', link_im);

    g.svg.selectAll('.node ellipse' ).classed('active_ib', node_ib);
    g.svg.selectAll('.node ellipse' ).classed('active_im', node_im);
    g.svg.selectAll('.node ellipse' ).classed('active_mo', node_mo);

    var src_tmp   = g.sources[orig_node.node.name];
    var sources   = src_tmp ? Object.keys(src_tmp).sort().join('<br>') : '';

    var targets   = orig_node.node.imports.sort().join('<br>');

    var html_ib   = on_mouseover_h('ib', sources);
    var html_im   = on_mouseover_h('im', targets);
    var html      = '<h3 class="mo">Username</h3>'
                  + '<span class="mo">' + orig_node.node.name + '</span>'
                  + html_ib + html_im;

    notes.html(html);

    precis.text(orig_node.node.name);
  }
};
// lib_plot.js

var setup_plot = function(plot_info) {

  var g = plot_info.global;

  g.angle_dom = [], g.angle_rng = [];

  axes_info = plot_info.axes;
  for (var axis_name in axes_info) {
    axis_info = axes_info[axis_name];
    g.angle_dom.push(axis_name);
    g.angle_rng.push(axis_info.angle);
  }

  g.angle_f     = d3.scale.ordinal().domain(g.angle_dom).range(g.angle_rng);

  var radii     = [ g.inner_radius, g.outer_radius ]
  g.radius_f    = d3.scale.linear().range(radii);

  g.color_f     = d3.scale.category10();

  g.transform   = 'translate(' + g.x_off + ',' + g.y_off + ')';

  g.svg         = d3.select(g.selector + ' .chart')
                    .append('svg')
                      .attr('width',      g.x_max)
                      .attr('height',     g.y_max)
                      .append('g')
                        .attr('transform',  g.transform);

  // console.log('plot_info', plot_info); //T
};


var degrees = function(radians) { return radians / Math.PI * 180 - 90; }


var display_plot = function(plot_info) {

  var g = plot_info.global;

  // Set the radius domain.

  var index   = function(d) { return d.index; };

  var extent  = d3.extent(g.nodes, index);
  g.radius_f.domain(extent);


  // Draw the axes.

  var transform = function(d) {
    return 'rotate(' + degrees( g.angle_f(d.key) ) + ')';
  };

  var x1 = g.radius_f(0) - 10;
  var x2 = function(d) { return g.radius_f(d.count) + 10; };

  g.svg.selectAll('.axis')
    .data(g.nodesByType)
    .enter().append('line')
      .attr('class', 'axis')
      .attr('transform', transform)
      .attr('x1', x1)
      .attr('x2', x2);

  // Draw the links.

  var path_angle  = function(d) { return g.angle_f(d.type);    };
  var path_radius = function(d) { return g.radius_f(d.node.index); };

  g.svg.append('g')
    .attr('class', 'links')
    .selectAll('.link')
    .data(g.links)
    .enter().append('path')
      .attr('d', make_link().angle(path_angle).radius(path_radius) )
      .attr('class', 'link')
      .on('mouseover', on_mouseover_link)
      .on('mouseout',  on_mouseout);

  // Draw the nodes.  Note that each node can have up to two connectors,
  // representing the source (outgoing) and target (incoming) links.

  var connectors  = function(d) { return d.connectors; };
  var cx          = function(d) { return g.radius_f(d.node.index); };
  var fill        = function(d) { return g.color_f(d.packageName); };

  var transform   = function(d) {
    return 'rotate(' + degrees( g.angle_f(d.type) ) + ')';
  };

  g.svg.append('g')
    .attr('class', 'nodes')
    .selectAll('.node')
    .data(g.nodes)
    .enter().append('g')
      .attr('class', 'node')
      .style('fill', fill)
      .selectAll('ellipse')
      .data(connectors)
      .enter().append('ellipse')
        .attr('transform', transform)
        .attr('cx', cx)
        .attr('rx', 4)
        .attr('ry', 6)
        .on('mouseover', on_mouseover_node)
        .on('mouseout',  on_mouseout);
};
// main.js

  var snap      = function(i) { return function() { return i; }; }

  var get_info  = function(data_set, format) {

    var degree  = Math.PI / 180,
        x_max   = 600,    x_off   = x_max * 0.5,
        y_max   = 700,    y_off   = y_max * 0.5;

    if (format === 'conv') {  // "conventional"
      var a_off   =   20,
          a_so    =    0,     a_st    = (120 - a_off),
          a_to    = -120,     a_ts    = (120 + a_off),
          i_rad   =   25,     o_rad   = 300;

    } else {                  // "rectangular"
      var a_so    =  -45,     a_st    = 45,
          a_to    = -135,     a_ts    = 135,
          i_rad   =   25,     o_rad   = 350;
    }

    var info  = {
      'global': {
        'selector':       ( snap(data_set) )(),
        'x_max':          x_max,      'x_off':          x_off,
        'y_max':          y_max,      'y_off':          y_off,
        'inner_radius':   i_rad,      'outer_radius':   o_rad
      },

      'axes': {
        'source':         { 'angle':  degree * a_so },
        'source-target':  { 'angle':  degree * a_st },
        'target-source':  { 'angle':  degree * a_ts },
        'target':         { 'angle':  degree * a_to }
      }
    };

    return info;
  };


  var data_sets     = { '#chart2':   'hive-data.json' };

  var info_sets     = {};

  for (var data_set in data_sets) {

    info_sets[data_set]  = get_info(data_set, 'conv');

    var func_f = function() {
      var info_set  = info_sets[data_set];

      var func  = function(nodes) {
        prep_data(info_set, nodes);
        setup_mouse(info_set);
        display_plot(info_set);
      };
      return func;
    };

    setup_plot(info_sets[data_set]);
    d3.json(data_sets[data_set], func_f() );
  }
