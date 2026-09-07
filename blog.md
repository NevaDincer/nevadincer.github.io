---
layout: default
title: Blog
permalink: /blog/
---

{% include motif.html curve="blog" %}
<h2>Blog</h2>

{% if site.posts.size == 0 %}
<p class="entry-body" style="color: var(--color-text-muted);">Nothing here yet. First posts coming once there's something worth writing about.</p>
{% else %}
{% for post in site.posts %}
<div class="entry">
  <div class="entry-header">
    <span class="entry-title"><a href="{{ post.url | relative_url }}">{{ post.title }}</a></span>
    <span class="entry-date">{{ post.date | date: "%b %Y" }}</span>
  </div>
</div>
{% endfor %}
{% endif %}
